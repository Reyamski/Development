/**
 * Same device-code SSO flow as EDT Hub `server/src/routes/aws.ts`:
 * `aws sso login --profile <default>` with stdout/stderr parsing for URL + code.
 */
import { spawn, ChildProcess } from 'child_process';

let activeSsoProc: ChildProcess | null = null;
let ssoLoginInfo: { code: string | null; url: string | null } = { code: null, url: null };

/** Profile used for the initial SSO session (must be an SSO profile in ~/.aws/config). */
function deviceLoginProfile(): string {
  return process.env.QUERY_HUB_SSO_DEVICE_PROFILE?.trim() || 'default';
}

export function getDeviceSsoLoginInfo(): { code: string | null; url: string | null } {
  return { ...ssoLoginInfo };
}

/**
 * Start AWS SSO login — opens browser on the API host; client polls {@link getDeviceSsoLoginInfo} and SSO token cache.
 */
export function startDeviceSsoLogin(): { started: boolean } {
  if (activeSsoProc) {
    activeSsoProc.kill();
    activeSsoProc = null;
  }

  ssoLoginInfo = { code: null, url: null };

  const profile = deviceLoginProfile();
  const proc = spawn('aws', ['sso', 'login', '--profile', profile], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  activeSsoProc = proc;

  let output = '';
  const parseOutput = (chunk: Buffer) => {
    output += chunk.toString();
    const urlMatch = output.match(/(https:\/\/\S+\/device\S*)/);
    if (urlMatch && !ssoLoginInfo.url) {
      ssoLoginInfo = { ...ssoLoginInfo, url: urlMatch[1] };
    }
    const codeMatch = output.match(/code:\s*\n?\s*([A-Z]{4}-[A-Z]{4})/);
    if (codeMatch && !ssoLoginInfo.code) {
      ssoLoginInfo = { ...ssoLoginInfo, code: codeMatch[1] };
    }
  };

  proc.stdout?.on('data', parseOutput);
  proc.stderr?.on('data', parseOutput);

  proc.on('exit', () => {
    activeSsoProc = null;
    ssoLoginInfo = { code: null, url: null };
  });
  proc.on('error', () => {
    activeSsoProc = null;
    ssoLoginInfo = { code: null, url: null };
  });

  return { started: true };
}
