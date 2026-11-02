export const IDENTITY = 'Sou Scarlett, criada por mark.code, um dev solo.';

// Direct identity questions are application metadata, not model predictions.
// Only match questions about Scarlett; do not intercept questions about other projects.
export function identityReply(input) {
  const text = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\s+/g, ' ').trim().replace(/[?!.,;:]+$/g, '')
    .replace(/^(?:oi|ola|e ai|hey|bom dia|boa tarde|boa noite)[,!: ]+/, '')
    .replace(/^(?:me diga|me fala|me fale|diga|quero saber|por favor)[,: ]+/, '');
  const target = '(?:voce|vc|tu|scarlett|a scarlett)';
  const verb = '(?:criou|fez|desenvolveu|programou|cria|desenvolve)';
  const patterns = [
    new RegExp(`^quem ${verb} ${target}$`),
    new RegExp(`^quem (?:te|lhe) ${verb}$`),
    /^(?:quem|qual) (?:e |foi )?(?:o |a )?(?:seu|sua|teu|tua) (?:criador|criadora|desenvolvedor|desenvolvedora|autor|autora)$/,
    /^(?:quem|qual) (?:e |foi )?(?:o |a )?(?:criador|criadora|desenvolvedor|desenvolvedora|autor|autora) (?:da |de )?scarlett$/,
    new RegExp(`^(?:por quem )?${target} (?:foi|e) (?:criada|criado|feita|feito|desenvolvida|desenvolvido)(?: por quem)?$`),
    /^(?:quem e voce|quem e vc|qual (?:e )?(?:o )?seu nome|quem voce e)$/,
    /^(?:who (?:created|made|developed|built) you|who is your (?:creator|developer)|who are you)$/
  ];
  return patterns.some(pattern => pattern.test(text)) ? IDENTITY : null;
}
