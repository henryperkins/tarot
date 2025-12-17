export function getClientIdentifier(request) {
  const headerCandidates = [
    'cf-connecting-ip',
    'x-forwarded-for',
    'x-real-ip'
  ];

  for (const header of headerCandidates) {
    const value = request?.headers?.get(header);
    if (value) {
      if (header === 'x-forwarded-for') {
        return value.split(',')[0].trim();
      }
      return value;
    }
  }

  return 'anonymous';
}

