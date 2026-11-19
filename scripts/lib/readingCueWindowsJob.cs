// Loaded by Windows PowerShell in a dedicated process. The launcher owns its
// stdin pipe. EOF also cleans up the job if the launcher itself disappears.
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class ReadingCueJob
{
    // Layouts from winnt.h, including pointer-sized fields on both architectures.
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits
    {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimits
    {
        public BasicLimits Basic;
        public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemory, PeakJobMemory;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Accounting
    {
        public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime;
        public uint TotalPageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
    }

    private const uint KillOnJobClose = 0x2000;
    private const int JobObjectExtendedLimitInformation = 9;
    private const int JobObjectBasicAccountingInformation = 1;

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern SafeFileHandle CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(SafeFileHandle job, int infoClass, ref ExtendedLimits limits, int size);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(SafeFileHandle job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateJobObject(SafeFileHandle job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool QueryInformationJobObject(SafeFileHandle job, int infoClass, out Accounting info, int size, IntPtr returned);

    private static void Check(bool success)
    {
        if (!success) throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    private static uint ActiveProcesses(SafeFileHandle job)
    {
        Accounting info;
        Check(QueryInformationJobObject(job, JobObjectBasicAccountingInformation, out info, Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero));
        return info.ActiveProcesses;
    }

    public static int Watch(int pid)
    {
        using (SafeFileHandle job = CreateJobObject(IntPtr.Zero, null))
        using (Process child = Process.GetProcessById(pid))
        {
            Check(!job.IsInvalid);
            ExtendedLimits limits = new ExtendedLimits();
            limits.Basic.Flags = KillOnJobClose;
            Check(SetInformationJobObject(job, JobObjectExtendedLimitInformation, ref limits, Marshal.SizeOf(limits)));

            // Pin the process handle before asking the original fork to answer.
            // A recycled PID cannot answer on the original fork's stdout pipe.
            IntPtr childHandle = child.Handle;
            Console.WriteLine("identify");
            Console.Out.Flush();
            if (Console.ReadLine() != "identified") return 1;
            Check(AssignProcessToJobObject(job, childHandle));
            Console.WriteLine("assigned");
            Console.Out.Flush();
            Console.ReadLine();

            Check(TerminateJobObject(job, 1));
            Stopwatch deadline = Stopwatch.StartNew();
            while (ActiveProcesses(job) != 0)
            {
                if (deadline.ElapsedMilliseconds >= 5000) return 1;
                Thread.Sleep(20);
            }
            return 0;
        }
    }
}
