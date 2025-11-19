import os
import sys
import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path
import fnmatch

EXTENSION_LANGS = {
    '.py': 'python',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.cjs': 'javascript',
    '.json': 'json',
    '.html': 'html',
    '.css': 'css',
    '.sh': 'bash',
    '.toml': 'toml',
    '.sql': 'sql',
    '.log': 'text',
}

def parse_gitignore(gitignore_path):
    """
    Parses a .gitignore file and returns a list of patterns to ignore.
    """
    patterns = []
    try:
        with open(gitignore_path, 'r', encoding='utf-8') as file:
            for line in file:
                stripped_line = line.strip()
                if stripped_line and not stripped_line.startswith('#'):
                    patterns.append(stripped_line)
    except FileNotFoundError:
        pass
    return patterns

def should_ignore(path, ignore_patterns):
    """
    Determines if a given file or directory should be ignored based on the ignore patterns.
    """
    for pattern in ignore_patterns:
        if fnmatch.fnmatch(path, pattern) or fnmatch.fnmatch(os.path.basename(path), pattern):
            return True
    return False

def rename_and_modify_files_to_md(directory, recursive=False, dry_run=False, log_callback=None):
    """
    Renames all supported files in the specified directory to .md
    and wraps their contents in Markdown code fences, while respecting .gitignore.
    """
    if not os.path.isdir(directory):
        msg = f"Error: The path '{directory}' is not a valid directory."
        if log_callback:
            log_callback(msg)
        else:
            print(msg)
        return

    gitignore_path = os.path.join(directory, '.gitignore')
    ignore_patterns = parse_gitignore(gitignore_path)

    if recursive:
        walker = os.walk(directory)
    else:
        try:
            files = os.listdir(directory)
        except OSError as e:
            msg = f"Error accessing directory '{directory}': {e}"
            if log_callback:
                log_callback(msg)
            else:
                print(msg)
            return
        walker = [(directory, [], files)]

    for root, dirs, files in walker:
        dirs[:] = [d for d in dirs if not should_ignore(os.path.join(root, d), ignore_patterns)]

        for filename in files:
            file_ext = os.path.splitext(filename)[1].lower()
            file_path = os.path.join(root, filename)

            if should_ignore(file_path, ignore_patterns):
                msg = f"Ignoring '{file_path}' due to .gitignore rules."
                if log_callback:
                    log_callback(msg)
                else:
                    print(msg)
                continue

            if file_ext in EXTENSION_LANGS:
                old_path = os.path.join(root, filename)
                new_filename = os.path.splitext(filename)[0] + '.md'
                new_path = os.path.join(root, new_filename)

                if os.path.exists(new_path):
                    msg = f"Skipping '{old_path}': '{new_filename}' already exists."
                    if log_callback:
                        log_callback(msg)
                    else:
                        print(msg)
                    continue

                if dry_run:
                    msg = f"[Dry Run] Would rename: '{old_path}' -> '{new_path}' and modify contents."
                    if log_callback:
                        log_callback(msg)
                    else:
                        print(msg)
                else:
                    try:
                        os.rename(old_path, new_path)
                        msg = f"Renamed: '{old_path}' -> '{new_path}'"
                        if log_callback:
                            log_callback(msg)
                        else:
                            print(msg)

                        with open(new_path, 'r', encoding='utf-8') as file:
                            content = file.read()

                        language = EXTENSION_LANGS[file_ext]
                        wrapped_content = f"```{language}\n{content}\n```"

                        with open(new_path, 'w', encoding='utf-8') as file:
                            file.write(wrapped_content)

                        msg = f"Modified contents of '{new_path}' to include Markdown code fences."
                        if log_callback:
                            log_callback(msg)
                        else:
                            print(msg)
                    except OSError as e:
                        msg = f"Error processing '{old_path}': {e}"
                        if log_callback:
                            log_callback(msg)
                        else:
                            print(msg)

def clone_github_repo(repo_url, destination, log_callback=None):
    """
    Clones a GitHub repository to the specified destination using GitHub CLI.
    """
    try:
        subprocess.run(["gh", "--version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        msg = f"Cloning repository '{repo_url}' into '{destination}'..."
        if log_callback:
            log_callback(msg)
        else:
            print(msg)

        subprocess.run(["gh", "repo", "clone", repo_url, destination], check=True)

        msg = f"Successfully cloned '{repo_url}'."
        if log_callback:
            log_callback(msg)
        else:
            print(msg)
        return True
    except subprocess.CalledProcessError as e:
        msg = f"Error cloning repository '{repo_url}': {e}"
        if log_callback:
            log_callback(msg)
        else:
            print(msg)
        return False
    except FileNotFoundError:
        msg = "GitHub CLI ('gh') is not installed or not found in PATH."
        if log_callback:
            log_callback(msg)
        else:
            print(msg)
        return False

def create_directory_copy(original_dir, output_dir=None, log_callback=None):
    """
    Creates a copy of the specified directory. If output_dir is provided, copies to that location.
    Otherwise, appends '_renamed' to the original directory name.
    """
    if output_dir:
        copy_dir = os.path.abspath(output_dir)
    else:
        parent_dir, dir_name = os.path.split(os.path.abspath(original_dir))
        copy_dir_name = f"{dir_name}_renamed"
        copy_dir = os.path.join(parent_dir, copy_dir_name)

    if os.path.exists(copy_dir):
        msg = f"Copy directory '{copy_dir}' already exists. Removing it first."
        if log_callback:
            log_callback(msg)
        else:
            print(msg)
        shutil.rmtree(copy_dir)

    try:
        shutil.copytree(original_dir, copy_dir)
        msg = f"Created a copy of '{original_dir}' at '{copy_dir}'."
        if log_callback:
            log_callback(msg)
        else:
            print(msg)
        return copy_dir
    except Exception as e:
        msg = f"Error copying directory '{original_dir}' to '{copy_dir}': {e}"
        if log_callback:
            log_callback(msg)
        else:
            print(msg)
        return None

def process_input(input_path_or_url, is_url, output_dir=None, log_callback=None):
    """
    Processes the input, cloning if it's a GitHub URL or using the local directory.
    """
    if is_url:
        temp_dir = tempfile.mkdtemp()
        success = clone_github_repo(input_path_or_url, temp_dir, log_callback)
        if not success:
            return None
        original_dir = temp_dir
    else:
        original_dir = input_path_or_url
        if not os.path.isdir(original_dir):
            msg = f"Error: The path '{original_dir}' is not a valid directory."
            if log_callback:
                log_callback(msg)
            else:
                print(msg)
            return None

    copied_dir = create_directory_copy(original_dir, output_dir, log_callback)
    return copied_dir

def run_cli(args):
    """
    Executes the CLI functionality based on parsed arguments.
    """
    if args.directory:
        input_path_or_url = args.directory
        is_url = False
    elif args.url:
        input_path_or_url = args.url
        is_url = True
    else:
        print("Error: Please provide either a directory or a GitHub URL.")
        sys.exit(1)

    output_dir = args.output

    directory_to_process = process_input(input_path_or_url, is_url, output_dir, log_callback=print)
    if directory_to_process is None:
        print("Processing aborted due to errors.")
        sys.exit(1)

    rename_and_modify_files_to_md(
        directory=directory_to_process,
        recursive=args.recursive,
        dry_run=args.dry_run,
        log_callback=print
    )

def build_supported_extensions_description():
    extensions_list = ', '.join(sorted(EXTENSION_LANGS.keys()))
    return f"Rename all {extensions_list} files in a directory or GitHub repo to .md and modify contents, respecting .gitignore."

def main():
    parser = argparse.ArgumentParser(description=build_supported_extensions_description())
    group = parser.add_mutually_exclusive_group()
    group.add_argument("-d", "--directory", help="Path to the target local directory")
    group.add_argument("-u", "--url", help="GitHub repository URL to clone and process")
    parser.add_argument("-o", "--output", help="Destination directory for the copied and renamed contents")
    parser.add_argument("-r", "--recursive", action="store_true",
                        help="Recursively rename supported files in subdirectories")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be renamed and modified without making any changes")

    args = parser.parse_args()

    if not args.directory and not args.url:
        parser.print_help()
        sys.exit(1)

    run_cli(args)

if __name__ == "__main__":
    main()
