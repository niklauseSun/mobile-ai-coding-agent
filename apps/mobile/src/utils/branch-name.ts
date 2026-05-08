export function createBranchSeed(date = new Date()) {
  const isoDate = date.toISOString();
  const day = isoDate.slice(0, 10).replace(/-/g, '');
  const time = isoDate.slice(11, 19).replace(/:/g, '');
  return `${day}-${time}`;
}

export function createAutoBranchName(prompt: string, seed: string) {
  const slug =
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36) || 'task';

  return `mobile-ai/${seed}-${slug}`;
}

export function isValidBranchName(branchName: string) {
  return (
    branchName.length > 0 &&
    branchName.length <= 120 &&
    branchName !== 'HEAD' &&
    /^[A-Za-z0-9._/-]+$/.test(branchName) &&
    !branchName.startsWith('/') &&
    !branchName.endsWith('/') &&
    !branchName.endsWith('.') &&
    !branchName.includes('//') &&
    !branchName.includes('..') &&
    !branchName.includes('@{')
  );
}
