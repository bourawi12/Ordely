import { MailMessage } from './mail.service';
import { escapeHtml } from './verify-email.template';

/** The "choose a new password" email, in French like the sign-in pages. */
export function resetPasswordMessage(params: {
  to: string;
  name: string;
  link: string;
}): MailMessage {
  const name = escapeHtml(params.name);
  const link = escapeHtml(params.link);
  return {
    to: params.to,
    subject: 'Réinitialisez votre mot de passe — Ordely',
    text: [
      `Bonjour ${params.name},`,
      '',
      'Vous avez demandé à changer votre mot de passe Ordely. Choisissez-en un nouveau ici :',
      params.link,
      '',
      'Ce lien est valable 1 heure et ne fonctionne qu’une fois. Si vous n’avez rien demandé, ignorez cet e-mail : votre mot de passe actuel reste valable.',
    ].join('\n'),
    // Inline styles only: most email clients drop <style> blocks.
    html: `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:32px 16px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0b1f44">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dde6f5;border-radius:16px">
          <tr><td style="padding:32px">
            <p style="margin:0 0 24px;font-size:26px;font-weight:800;color:#1e63ff">ordely</p>
            <h1 style="margin:0 0 12px;font-size:22px">Réinitialisez votre mot de passe</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a5a7a">
              Bonjour ${name}, vous avez demandé à changer votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
            </p>
            <a href="${link}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#1e63ff;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">Choisir un nouveau mot de passe</a>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#4a5a7a">
              Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br>
              <a href="${link}" style="color:#1e63ff;word-break:break-all">${link}</a>
            </p>
            <p style="margin:24px 0 0;font-size:13px;color:#8a97b0">
              Ce lien est valable 1 heure et ne fonctionne qu’une fois. Si vous n’avez rien demandé, ignorez cet e-mail : votre mot de passe actuel reste valable.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
