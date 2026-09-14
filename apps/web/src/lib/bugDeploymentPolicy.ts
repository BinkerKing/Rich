const deploymentRequest = /(?:重新)?部署|重新发布|重启/i;
const deploymentDecline = /(?:不(?:要|需(?:要)?|用)?|无需|不要|别)\s*(?:(?:重新)?部署|重新发布|重启)/i;

export function shouldRedeployLatestApp(message: string): boolean {
  return deploymentRequest.test(message) && !deploymentDecline.test(message);
}
