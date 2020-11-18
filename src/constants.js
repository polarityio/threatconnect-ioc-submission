const IGNORED_IPS = new Set(['127.0.0.1', '255.255.255.255', '0.0.0.0']);

const INDICATOR_TYPES = {
  files: 'file',
  emailAddresses: 'emailAddress',
  hosts: 'host',
  addresses: 'address'
};
const POLARITY_TYPE_TO_THREATCONNECT = {
  IPv4: 'addresses',
  IPv6: 'addresses',
  hash: 'files',
  email: 'emailAddresses',
  domain: 'hosts'
};

const SUBMISSION_LABELS = {
  IPv4: 'ip',
  IPv6: 'ip',
  MD5: 'md5',
  SHA1: 'sha1',
  SHA256: 'sha256',
  email: 'address',
  domain: 'hostName'
};

const ENTITY_TYPES = {
  domain: 'domain',
  IPv4: 'ip',
  IPv6: 'ip',
  email: 'email',
  MD5: 'md5',
  SHA1: 'sha1',
  SHA256: 'sha256'
};

module.exports = {
  IGNORED_IPS,
  INDICATOR_TYPES,
  POLARITY_TYPE_TO_THREATCONNECT,
  SUBMISSION_LABELS,
  ENTITY_TYPES
};
