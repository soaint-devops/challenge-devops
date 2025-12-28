'use strict';

const crypto = require('crypto');

function generateCredentials(passphrase) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const userRaw = crypto.createHmac('sha256', key).update(crypto.randomBytes(16)).digest('hex');
  const passRaw = crypto.randomBytes(12).toString('base64url');
  const username = `u-${userRaw.slice(0, 8)}`;
  const password = `p-${passRaw}`;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(JSON.stringify({ username, password }), 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();

  const encrypted = {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    salt: salt.toString('base64'),
    algorithm: 'aes-256-gcm',
  };

  return { username, password, encrypted };
}

module.exports = { generateCredentials };
