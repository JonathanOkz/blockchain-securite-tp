// Mission 5 : parcours guidé en trois étapes, montants prédéfinis, un bouton principal.
const fmt = (value, digits = 2) => Number(value).toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) });

export const sandwichSteps = [
  {
    label: 'Achat normal',
    title: 'Regardez un achat normal',
    text: 'La cliente dépense 1 000 USDT pour acheter une autre monnaie, appelée DEX. Regardez combien elle reçoit quand personne ne passe avant elle.',
    action: 'Lancer l’achat normal',
    done: 'Voici votre point de comparaison.'
  },
  {
    label: 'Sandwich',
    title: 'Passez avant la cliente',
    text: 'Vous achetez pour 1 000 USDT juste avant elle. Son achat fait encore monter le prix. Vous revendez ensuite vos DEX.',
    action: 'Lancer l’attaque',
    done: 'La cliente paie le même montant mais reçoit moins de DEX.'
  },
  {
    label: 'Protection 1 %',
    title: 'Protégez son achat',
    text: 'La cliente refuse maintenant de recevoir plus de 1 % de DEX en moins que prévu. Rejouez la même attaque pour voir ce qui change.',
    action: 'Tester la protection',
    done: 'La cliente a refusé le mauvais prix. Elle conserve ses USDT.'
  }
];

export function sequenceHTML(step) {
  const lane = (who, what, tone = '') => `<li class="seq-item ${tone}"><span class="seq-who">${who}</span><span class="seq-what">${what}</span></li>`;
  if (step === 0) return `<ol class="sequence-lane">${lane('Cliente', 'Achète des DEX pour 1 000 USDT', 'customer')}</ol>`;
  return `<ol class="sequence-lane">
    ${lane('Vous', 'Achetez des DEX pour 1 000 USDT', 'attacker')}
    ${lane('Cliente', step === 2 ? 'Achète si elle reçoit au moins 99 % du devis' : 'Achète des DEX pour 1 000 USDT', 'customer')}
    ${lane('Vous', 'Revendez vos DEX', 'attacker')}
  </ol>`;
}

const metric = (label, value, note = '', tone = '') => `<div class="metric ${tone}"><span class="metric-label">${label}</span><strong>${value}</strong>${note ? `<span class="metric-note">${note}</span>` : ''}</div>`;

export function resultHTML(step, s) {
  if (!s?.completed) return '';
  const unitPrice = dex => Number(dex) > 0 ? fmt(1000 / Number(dex), 3) : '—';
  if (step === 0) {
    return `<div class="metrics one">${metric('La cliente reçoit', `${fmt(s.received)} DEX`, `pour 1 000 USDT, soit ${unitPrice(s.received)} USDT par DEX`)}</div>
      <p class="result-note">Gardez cette quantité en tête : c’est ce qu’elle devrait recevoir à chaque fois.</p>`;
  }
  if (step === 1) {
    const ratio = Math.max(0, Math.min(100, Number(s.received) / Number(s.baseline) * 100));
    const lost = Number(s.shortfall) / Number(s.baseline) * 100;
    return `<div class="metrics">
        ${metric('Votre gain net', `+${fmt(s.profit)} USDT`, 'frais d’échange déduits', 'gain')}
        ${metric('La cliente reçoit en moins', `${fmt(s.shortfall)} DEX`, `soit −${fmt(lost, 1)} %`, 'loss')}
      </div>
      <div class="compare" aria-label="DEX reçus par la cliente">
        <div class="compare-row"><span>Sans attaque</span><div class="compare-bar"><i style="width:100%"></i></div><b>${fmt(s.baseline)} DEX</b></div>
        <div class="compare-row loss"><span>Avec votre attaque</span><div class="compare-bar"><i style="width:${ratio.toFixed(1)}%"></i></div><b>${fmt(s.received)} DEX</b></div>
      </div>
      <p class="result-note">Pour les mêmes 1 000 USDT, elle paie ${unitPrice(s.received)} USDT par DEX au lieu de ${unitPrice(s.baseline)}.</p>`;
  }
  if (s.executed) return '<p class="result-note">L’achat de la cliente a été exécuté. Consultez les preuves avant de conclure.</p>';
  return `<div class="metrics">
      ${metric('La cliente conserve', `${fmt(s.customerUSDT)} USDT`, 'son achat est annulé', 'gain')}
      ${metric('Votre résultat net', `${fmt(s.profit)} USDT`, 'vous payez les frais pour rien', 'loss')}
    </div>
    <p class="result-note">Votre achat et votre revente ont eu lieu. Sans l’achat de la cliente entre les deux, vous perdez les frais d’échange.</p>`;
}

export function mechanismHTML() {
  return `<p>La pool échange des USDT contre des DEX. Plus on achète de DEX, plus leur prix monte. Chaque échange coûte 0,3 % de frais.</p>
    <p>Ici, un programme fixe l’ordre des échanges sur BaaS. Il montre l’effet d’un sandwich sans intercepter de transactions sur le réseau.</p>`;
}
