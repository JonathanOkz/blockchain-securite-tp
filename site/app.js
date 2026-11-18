import { ethers } from './vendor/ethers.min.js';
import { sandwichSteps, sequenceHTML, resultHTML, mechanismHTML } from './sandwich-guide.js';

const $ = id => document.getElementById(id);
const configuration = await fetch('./config.json').then(r => r.json());
const ZERO = ethers.ZeroAddress;
const CHAIN_HEX = '0x' + BigInt(configuration.chainId).toString(16);

const abi = {
  factory: ['function createMission(uint8 kind,bool fixedVersion) returns(address target)', 'event MissionCreated(address indexed player,uint8 indexed kind,bool fixedVersion,address target)'],
  common: ['function player() view returns(address)', 'function fixedVersion() view returns(bool)', 'function token() view returns(address)'],
  access: ['function administrator() view returns(address)', 'function recipient() view returns(address)', 'function legitimateRecipient() view returns(address)', 'function paidTo() view returns(address)', 'function setRecipient(address)', 'function pay()'],
  merkle: ['function root() view returns(bytes32)', 'function legitimateRecipient() view returns(address)', 'function otherRecipient() view returns(address)', 'function leaf(string,address) pure returns(bytes32)', 'function verifyBeneficiary(string,address,bytes32[]) view returns(bool)', 'function proofFor(uint8) view returns(bytes32[])', 'function pay(string,address,bytes32[])', 'function paidTo() view returns(address)', 'function paidNameHash() view returns(bytes32)'],
  reentry: ['function normalWithdraw()', 'function attack(uint256)', 'function bank() view returns(address)', 'function receiver() view returns(address)', 'function remaining() view returns(uint256)', 'function received() view returns(uint256)', 'function callbacks() view returns(uint256)', 'function entitlement() view returns(uint256)'],
  replay: ['function voucherHash() view returns(bytes32)', 'function validSignature(bytes) view returns(bool)', 'function redeem(bytes)', 'function totalPaid() view returns(uint256)', 'function used() view returns(bool)'],
  sandwich: ['function runNormal()', 'function runSandwich(uint256 amountUSDT)', 'function baseline() view returns(uint256)', 'function customerReceived() view returns(uint256)', 'function customerShortfall() view returns(uint256)', 'function attackerProfit() view returns(int256)', 'function completed() view returns(bool)', 'function customerExecuted() view returns(bool)', 'function toleranceBps() view returns(uint256)', 'function minimumReceived() view returns(uint256)', 'function customer() view returns(address)', 'function attacker() view returns(address)', 'function pool() view returns(address)', 'function attackAmount() view returns(uint256)', 'function attackerSale() view returns(uint256)'],
  token: ['function balanceOf(address) view returns(uint256)']
};

const NAMES = { [ethers.id('ATELIER MARTIN')]: 'ATELIER MARTIN', [ethers.id('LUCAS DURAND')]: 'LUCAS DURAND' };

// ---------------------------------------------------------------------------
// Contenu des missions
// ---------------------------------------------------------------------------
const missions = [
  {
    key: 'access', short: 'Contrôle d’accès', title: 'Qui peut changer le destinataire ?',
    lead: 'Un service règle une facture de 10 USDT. Vous êtes un utilisateur ordinaire. Le destinataire devrait être réservé à l’administrateur.',
    goal: 'Détournez le paiement vers une autre adresse, prouvez-le, puis identifiez le contrôle qui manque.',
    app: 'Service de facturation', kind: 'Une facture de 10 USDT',
    help: 'Le destinataire prévu est enregistré dans le contrat. La facture ne peut être payée qu’une fois par instance.',
    question: 'Une fonction absente de l’interface est-elle inaccessible ? Quelle identité le contrat doit-il contrôler avant de modifier le destinataire ?',
    hints: ['Dans l’inspecteur, repérez une fonction qui change le destinataire. Le nom d’une fonction ne dit rien sur les personnes autorisées à l’appeler.', 'Votre adresse figure dans l’état de l’application. Essayez de la transmettre comme nouveau destinataire. Observez ensuite à qui le paiement arrive.'],
    source: 'function setRecipient(address next) external {\n    recipient = next;\n}\n\nfunction pay() external {\n    token.transfer(recipient, 10 ether);\n}',
    fixed: 'function setRecipient(address next) external {\n    require(msg.sender == administrator);\n    recipient = next;\n}\n\n// Le paiement normal reste accessible au joueur.',
    steps: [
      { label: 'Fonctionnement normal', text: 'Payez la facture avec le bouton de l’application. Les 10 USDT doivent arriver au destinataire prévu.', done: 'Le paiement a atteint le destinataire prévu. Vous avez votre référence.' },
      { label: 'Attaque', text: 'Vous repartez d’une instance neuve. Détournez le paiement vers une autre adresse. L’inspecteur donne accès à toutes les fonctions du contrat, même celles absentes de l’interface.', done: 'Le paiement est parti vers une autre adresse que le destinataire prévu.' },
      { label: 'Version corrigée', text: 'Rejouez exactement la même attaque sur la version corrigée. Le changement de destinataire doit être refusé.', done: 'Le contrat corrigé refuse votre changement de destinataire.' }
    ],
    fields: [
      { key: 'legitimateRecipient', label: 'Destinataire prévu', type: 'address' },
      { key: 'recipient', label: 'Destinataire enregistré', type: 'address', tone: s => same(s.recipient, s.legitimateRecipient) ? '' : 'loss' },
      { key: 'paidTo', label: 'Paiement envoyé à', type: 'address', tone: s => s.paidTo === ZERO ? '' : same(s.paidTo, s.legitimateRecipient) ? 'gain' : 'loss' },
      { key: 'contractCredits', label: 'USDT dans le contrat', type: 'usdt' },
      { key: 'administrator', label: 'Administrateur', type: 'address' },
      { key: 'playerCredits', label: 'Vos USDT', type: 'usdt', hidden: true }
    ]
  },
  {
    key: 'merkle', short: 'Paiement & Merkle', title: 'Une preuve refusée bloque-t-elle le paiement ?',
    lead: 'Un registre associe chaque entreprise à une adresse. Un fraudeur présente une autre adresse sous le nom d’Atelier Martin.',
    goal: 'Trouvez une demande pour laquelle la vérification répond faux alors que les USDT sont transférés.',
    app: 'Paiement fournisseur', kind: 'Registre de bénéficiaires',
    help: 'Chaque demande associe un nom, une adresse et une preuve. Vérifiez une demande avant de l’envoyer : la même demande doit servir aux deux appels.',
    question: 'Le contrat vérifie une preuve. Mais utilise-t-il son résultat pour autoriser le transfert ? Que doit-il vérifier sur le nom et le destinataire ?',
    hints: ['Une preuve correspond à un couple nom + adresse. Vous pouvez récupérer les preuves des deux entrées du registre dans l’inspecteur.', 'Essayez le nom d’Atelier Martin avec l’adresse de Lucas Durand. Faites vérifier exactement cette demande. Le paiement se comporte-t-il comme la vérification ?'],
    source: 'function pay(string memory name, address to,\n    bytes32[] memory proof) external {\n    verifyBeneficiary(name, to, proof);\n    token.transfer(to, 10 ether);\n}',
    fixed: 'function pay(string memory name, address to,\n    bytes32[] memory proof) external {\n    require(verifyBeneficiary(name, to, proof));\n    token.transfer(to, 10 ether);\n}',
    steps: [
      { label: 'Fonctionnement normal', text: 'Chargez Atelier Martin, vérifiez la demande, puis choisissez « Envoyer le paiement » dans l’inspecteur.', done: 'Paiement valide envoyé à Atelier Martin, preuve acceptée.' },
      { label: 'Attaque', text: 'Vous repartez d’une instance neuve. Envoyez une demande que la vérification refuse. Le contrat paie-t-il quand même ?', done: 'Le contrat a payé une demande dont la preuve était invalide.' },
      { label: 'Version corrigée', text: 'Envoyez la même demande incohérente à la version corrigée. Elle doit être refusée.', done: 'La version corrigée refuse la demande invalide.' }
    ],
    fields: [
      { key: 'martinCredits', label: 'Reçu par Atelier Martin', type: 'usdt', tone: s => Number(s.martinCredits) > 0 ? 'gain' : '' },
      { key: 'durandCredits', label: 'Reçu par Lucas Durand', type: 'usdt', tone: s => Number(s.durandCredits) > 0 ? 'loss' : '' },
      { key: 'paidTo', label: 'Paiement envoyé à', type: 'address' },
      { key: 'paidNameHash', label: 'Au nom de', type: 'name' },
      { key: 'legitimateRecipient', label: 'Atelier Martin', type: 'address' },
      { key: 'otherRecipient', label: 'Lucas Durand', type: 'address' },
      { key: 'root', label: 'Racine du registre', type: 'hash', wide: true },
      { key: 'contractCredits', label: 'USDT dans le contrat', type: 'usdt', hidden: true }
    ]
  },
  {
    key: 'reentry', short: 'Réentrance', title: 'Un retrait peut-il en déclencher plusieurs ?',
    lead: 'Un coffre contient 6 USDT. Votre contrat récepteur a droit à 1 USDT. Il peut rappeler le coffre pendant un versement.',
    goal: 'Obtenez plus que l’USDT autorisé. Suivez les rappels et comparez les soldes, puis rejouez sur la version corrigée.',
    app: 'Coffre de USDT', kind: 'Droit de retrait : 1 USDT',
    help: 'Un retrait normal verse 1 USDT au récepteur. Le récepteur fourni peut rappeler le coffre pendant le versement.',
    question: 'À quel moment le coffre retire-t-il le droit au paiement ? Le récepteur peut-il réutiliser ce droit avant la fin du premier appel ?',
    hints: ['Comparez l’ordre des deux opérations : appeler le récepteur et remettre son droit à zéro. Le récepteur peut exécuter du code pendant l’appel.', 'Le paramètre du récepteur fixe le nombre maximal de passages dans la séquence. Augmentez-le et comparez les USDT reçus au droit initial.'],
    source: 'function withdraw() external {\n    uint256 amount = entitlement;\n    require(amount > 0);\n    token.transfer(receiver, amount);\n    PaymentReceiver(receiver).onPayment();\n    entitlement = 0;\n}',
    fixed: 'function withdraw() external {\n    uint256 amount = entitlement;\n    require(amount > 0);\n    entitlement = 0;\n    token.transfer(receiver, amount);\n    PaymentReceiver(receiver).onPayment();\n}',
    steps: [
      { label: 'Fonctionnement normal', text: 'Faites un retrait normal. Le récepteur doit recevoir exactement 1 USDT.', done: 'Le récepteur a reçu 1 USDT : c’est son droit.' },
      { label: 'Attaque', text: 'Vous repartez d’une instance neuve. Obtenez plus que l’USDT autorisé avec « Retrait avec le contrat récepteur » dans l’inspecteur.', done: 'Le récepteur a obtenu plus que son droit de 1 USDT.' },
      { label: 'Version corrigée', text: 'Rejouez la même séquence, avec plusieurs passages, sur la version corrigée.', done: 'La version corrigée limite le versement à 1 USDT.' }
    ],
    fields: [
      { key: 'remaining', label: 'Coffre', type: 'usdt' },
      { key: 'received', label: 'Reçu par le récepteur', type: 'usdt', tone: s => Number(s.received) > 1 ? 'loss' : Number(s.received) === 1 ? 'gain' : '' },
      { key: 'entitlement', label: 'Droit restant', type: 'usdt' },
      { key: 'callbacks', label: 'Passages', type: 'count' },
      { key: 'receiver', label: 'Votre récepteur', type: 'address', hidden: true },
      { key: 'bank', label: 'Coffre', type: 'address', hidden: true }
    ]
  },
  {
    key: 'replay', short: 'Rejeu de signature', title: 'Encaisser deux fois un bon de paiement',
    lead: 'Un service autorise un remboursement de 10 USDT. Le bénéficiaire reçoit un bon signé. Peut-il présenter ce même bon plusieurs fois ?',
    goal: 'Encaissez deux fois le même bon. Comparez signatures, transactions et USDT versés, puis vérifiez la version corrigée.',
    app: 'Service de remboursement', kind: 'Un bon de 10 USDT',
    help: 'Pour préparer le bon, votre compte joue le service qui signe l’autorisation. Vous passez ensuite dans le rôle du bénéficiaire.',
    question: 'Une signature valide prouve-t-elle que le bon n’a jamais été utilisé ? Quelle information faut-il conserver après le paiement ?',
    hints: ['Conservez exactement la même signature pour le second encaissement. Ne préparez pas un nouveau bon.', 'Le second appel est une nouvelle transaction. Comparez l’identifiant du bon dans les deux événements VoucherPaid.'],
    source: 'function redeem(bytes memory signature) external {\n    require(validSignature(signature));\n    token.transfer(player, 10 ether);\n}',
    fixed: 'function redeem(bytes memory signature) external {\n    require(validSignature(signature));\n    require(!used);\n    used = true;\n    token.transfer(player, 10 ether);\n}',
    steps: [
      { label: 'Fonctionnement normal', text: 'Préparez le bon signé, puis encaissez-le une fois. 10 USDT doivent être versés.', done: '10 USDT versés : le bon fonctionne.' },
      { label: 'Attaque', text: 'Vous repartez d’une instance neuve. Préparez le bon, puis encaissez-le deux fois sans en préparer un nouveau.', done: 'Le même bon a été payé plusieurs fois.' },
      { label: 'Version corrigée', text: 'Encaissez le même bon deux fois sur la version corrigée. Le second encaissement doit être refusé.', done: 'La version corrigée refuse le bon déjà encaissé.' }
    ],
    fields: [
      { key: 'totalPaid', label: 'Total versé', type: 'usdt', tone: s => Number(s.totalPaid) > 10 ? 'loss' : Number(s.totalPaid) === 10 ? 'gain' : '' },
      { key: 'reserve', label: 'Réserve du service', type: 'usdt' },
      { key: 'used', label: 'Bon marqué consommé', type: 'bool' },
      { key: 'voucherId', label: 'Identifiant du bon', type: 'hash', wide: true }
    ]
  },
  {
    key: 'sandwich', short: 'Attaque sandwich', title: 'Faire payer plus cher l’achat d’une cliente', guided: true,
    lead: 'Découvrez en trois étapes comment passer avant une cliente peut lui faire perdre des tokens.',
    goal: 'Mesurez votre gain et la perte de la cliente, puis observez la protection.',
    question: 'Pourquoi l’ordre des échanges change-t-il le résultat ? Une tolérance de glissement de 1 % empêche-t-elle tous les sandwichs ?',
    hints: [], source: '', fixed: '',
    steps: sandwichSteps,
    fields: [
      { key: 'received', label: 'DEX reçus par la cliente', type: 'dex' },
      { key: 'profit', label: 'Résultat de l’attaquant', type: 'usdt' },
      { key: 'customerUSDT', label: 'USDT de la cliente', type: 'usdt' },
      { key: 'attackerUSDT', label: 'USDT de l’attaquant', type: 'usdt' },
      { key: 'completed', label: 'Scénario joué', type: 'bool' },
      { key: 'executed', label: 'Achat de la cliente exécuté', type: 'bool' }
    ]
  }
];

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------
let current = Math.max(0, Math.min(4, Number(location.hash.match(/^#mission-([1-5])$/)?.[1] || 1) - 1));
let busy = false, contract, wallet, browserProvider, walletStatus = window.ethereum ? 'disconnected' : 'missing', walletBalance = null;
const prefix = 'blockchain-security-lab-usdt-v3';
const provider = new ethers.JsonRpcProvider(configuration.rpc, configuration.chainId, { staticNetwork: true, batchMaxCount: 1, cacheTimeout: -1 });
provider.pollingInterval = 600;
const emptySave = () => ({ instances: {}, history: [], notes: {}, steps: {}, states: {}, vouchers: {}, args: {} });
let saved = emptySave();

function migrate(data) {
  const next = { ...emptySave(), ...data };
  for (const [k, v] of Object.entries(next.instances)) {
    const old = k.match(/^(\d):(vulnerable|fixed)$/), guide = k.match(/^sandwich-guide:(\d)$/);
    if (old && !next.instances[`${old[1]}:${old[2] === 'fixed' ? 2 : 0}`]) next.instances[`${old[1]}:${old[2] === 'fixed' ? 2 : 0}`] = v;
    if (guide && !next.instances[`4:${guide[1]}`]) next.instances[`4:${guide[1]}`] = v;
  }
  if (data?.guideStates) Object.assign(next.states, data.guideStates);
  if (data?.guideStep !== undefined && next.steps[4] === undefined) next.steps[4] = data.guideStep;
  return next;
}
function storageKey() { return prefix + wallet.address.toLowerCase(); }
function persist() {
  if (!wallet) return;
  try { localStorage.setItem(storageKey(), JSON.stringify(saved)); }
  catch { toast('Le navigateur ne peut pas conserver votre session. Exportez vos observations avant de quitter.', 'error'); }
}
function loadSaved() {
  let raw = null;
  try { raw = localStorage.getItem(storageKey()) || sessionStorage.getItem(storageKey()); } catch { }
  try { saved = migrate(JSON.parse(raw || 'null') || {}); } catch { saved = emptySave(); }
}

const stepOf = mi => Math.max(0, Math.min(2, Number(saved.steps[mi] ?? 0)));
const key = () => `${current}:${stepOf(current)}`;
const target = () => saved.instances[key()];
const instanceOf = (mi, si) => saved.instances[`${mi}:${si}`];
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// ---------------------------------------------------------------------------
// Portefeuille
// ---------------------------------------------------------------------------
async function connect(request = true) {
  if (!window.ethereum) { walletStatus = 'missing'; return false; }
  const accounts = await window.ethereum.request({ method: request ? 'eth_requestAccounts' : 'eth_accounts' });
  if (!accounts.length) { walletStatus = 'disconnected'; return false; }
  const chain = await window.ethereum.request({ method: 'eth_chainId' });
  if (BigInt(chain) !== BigInt(configuration.chainId)) { walletStatus = 'wrong-network'; return false; }
  browserProvider = new ethers.BrowserProvider(window.ethereum);
  browserProvider.pollingInterval = 600;
  wallet = await browserProvider.getSigner();
  walletStatus = 'ready';
  loadSaved();
  refreshBalance();
  return true;
}
async function switchNetwork() {
  try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] }); }
  catch (e) {
    const code = e?.code ?? e?.data?.originalError?.code;
    if (code === 4902 || /unrecognized|not been added|unknown chain/i.test(e?.message || '')) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: 'BaaS Euro-Information', rpcUrls: [configuration.rpc], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } }] });
    } else throw e;
  }
}
async function ensureReady() {
  if (walletStatus === 'ready') return true;
  try {
    if (walletStatus === 'missing') { toast('MetaMask est introuvable. Ouvrez ce site dans le navigateur où MetaMask est installé.', 'error'); return false; }
    if (walletStatus === 'wrong-network') { await switchNetwork(); return false; }
    const ok = await connect(true);
    if (ok) { render(); toast('Compte connecté. Votre progression est enregistrée pour ce compte.', 'success'); return true; }
    if (walletStatus === 'wrong-network') { paint(); await switchNetwork(); }
    return false;
  } catch (e) { toast(explain(e), 'error'); paint(); return false; }
}
async function refreshBalance() {
  if (!wallet) return;
  try { walletBalance = ethers.formatEther(await new ethers.Contract(configuration.token, abi.token, provider).balanceOf(wallet.address)); paintWallet(); } catch { }
}
if (window.ethereum) {
  window.ethereum.on?.('accountsChanged', () => location.reload());
  window.ethereum.on?.('chainChanged', () => location.reload());
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function display(value) { if (typeof value === 'bigint') return value.toString(); if (Array.isArray(value)) return value.map(display); return value; }
function serialize(value) { return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2); }
function number(value, digits = 4) { return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: digits }); }
function short(value) { return value && value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value; }
function credits(value) { return ethers.formatEther(value); }
function explain(e) {
  const s = e?.reason || e?.info?.error?.message || e?.shortMessage || e?.message || String(e);
  if (e?.code === 'ACTION_REJECTED' || e?.code === 4001 || /user (rejected|denied)/i.test(s)) return 'Demande annulée dans MetaMask. Rien n’a été envoyé.';
  if (/insufficient funds/i.test(s)) return 'Le compte ne peut pas envoyer cette transaction. Vérifiez la connexion au réseau BaaS.';
  if (/timeout/i.test(s)) return 'Le réseau n’a pas confirmé à temps. Ne renvoyez pas immédiatement la même demande : actualisez les preuves pour vérifier son état.';
  return s;
}
let toastTimer;
function toast(message, type = '', { spin = false } = {}) {
  const t = $('toast');
  const icon = spin ? '<span class="spinner" aria-hidden="true"></span>' : type === 'success' ? '<span class="t-icon" aria-hidden="true">✓</span>' : type === 'error' ? '<span class="t-icon" aria-hidden="true">!</span>' : '<span class="t-icon" aria-hidden="true">i</span>';
  t.className = `toast ${type}`;
  t.innerHTML = `${icon}<span class="t-msg">${esc(message)}</span><button class="toast-close" type="button" aria-label="Fermer">×</button>`;
  t.hidden = false;
  t.querySelector('.toast-close').onclick = () => { t.hidden = true; };
  clearTimeout(toastTimer);
  if (!spin && type !== 'error') toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}
function lock(on) {
  busy = on;
  document.body.classList.toggle('is-busy', on);
  document.querySelectorAll('button:not(.toast-close)').forEach(b => { b.disabled = on; });
}

function addressBook(s = {}) {
  const book = {};
  const add = (a, label) => { if (a && a !== ZERO && ethers.isAddress(a)) book[a.toLowerCase()] ??= label; };
  add(wallet?.address, 'Vous');
  add(s.legitimateRecipient, current === 0 ? 'Fournisseur prévu' : 'Atelier Martin');
  add(s.otherRecipient, 'Lucas Durand');
  add(s.administrator, 'Administrateur');
  add(s.receiver, 'Votre récepteur');
  add(s.bank, 'Coffre');
  add(s.pool, 'Pool USDT / DEX');
  add(s.customer, 'Cliente');
  add(s.attacker, 'Attaquant');
  add(target(), 'Contrat de la mission');
  return book;
}
function formatValue(type, value, book) {
  if (value === undefined || value === null) return '—';
  if (type === 'address') {
    if (value === ZERO) return '<span class="addr none">Aucun</span>';
    const label = book[String(value).toLowerCase()];
    return `<span class="addr">${label ? `<b>${esc(label)}</b>` : '<b>Adresse inconnue</b>'}<code title="${esc(value)}">${esc(short(value))}</code></span>`;
  }
  if (type === 'usdt') return `${esc(number(value))} <small>USDT</small>`;
  if (type === 'dex') return `${esc(number(value, 2))} <small>DEX</small>`;
  if (type === 'bool') return value ? 'Oui' : 'Non';
  if (type === 'hash') return `<code title="${esc(value)}">${esc(short(value))}</code>`;
  if (type === 'name') return value === ethers.ZeroHash ? '—' : esc(NAMES[value] || `Nom hors registre (${short(value)})`);
  return esc(value);
}

// ---------------------------------------------------------------------------
// Objectifs : déduits des preuves réelles (états lus et reçus de transaction)
// ---------------------------------------------------------------------------
const entriesFor = t => saved.history.filter(e => same(e.target, t));
const refused = (e, re) => e.success === false || (!!e.error && re.test(e.error));
const proofValid = e => e.events?.find(ev => ev.values?.proofValid !== undefined)?.values.proofValid;
// Une étape validée le reste, même après « Recommencer » sur une instance neuve.
function objectives(mi) {
  const live = liveObjectives(mi);
  saved.achieved ??= {};
  const kept = saved.achieved[mi] ??= [false, false, false];
  return live.map((v, i) => (kept[i] = kept[i] || !!v));
}
function liveObjectives(mi) {
  const state = t => (t && saved.states[t]) || null;
  const vulnerable = [instanceOf(mi, 0), instanceOf(mi, 1)].filter(Boolean);
  const fix = instanceOf(mi, 2);
  const anyV = f => vulnerable.some(t => f(state(t) || {}, entriesFor(t)));
  const onFix = f => !!fix && f(state(fix) || {}, entriesFor(fix));
  const paid = s => !!s.paidTo && s.paidTo !== ZERO;
  switch (mi) {
    case 0: return [
      anyV(s => paid(s) && same(s.paidTo, s.legitimateRecipient)),
      anyV(s => paid(s) && !same(s.paidTo, s.legitimateRecipient)),
      onFix((s, es) => es.some(e => e.function === 'setRecipient' && refused(e, /administrateur/i)))];
    case 1: return [
      anyV((s, es) => es.some(e => e.function === 'pay' && e.success && proofValid(e) === true)),
      anyV((s, es) => es.some(e => e.function === 'pay' && e.success && proofValid(e) === false)),
      onFix((s, es) => es.some(e => e.function === 'pay' && refused(e, /non reconnu/i)))];
    case 2: return [
      anyV(s => Number(s.received) === 1),
      anyV(s => Number(s.received) > 1),
      onFix((s, es) => Number(s.received) === 1 && es.some(e => e.function === 'attack' && e.success && Number(e.arguments?.[0]) > 1))];
    case 3: return [
      anyV(s => Number(s.totalPaid) >= 10),
      anyV(s => Number(s.totalPaid) > 10),
      onFix((s, es) => es.some(e => e.function === 'redeem' && refused(e, /deja encaisse/i)))];
    default: {
      const [a, b, c] = [0, 1, 2].map(i => state(instanceOf(4, i)));
      return [!!a?.completed, !!(b?.completed && b.executed), !!(c?.completed && !c.executed)];
    }
  }
}
const missionDone = mi => { const o = objectives(mi); return o[1] && o[2]; };

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
function useContract() { contract = target() && wallet ? new ethers.Contract(target(), [...abi.common, ...abi[missions[current].key]], wallet) : null; }

function render() {
  const m = missions[current];
  useContract();
  document.body.dataset.lab = m.key;
  $('mission-number').textContent = `Mission 0${current + 1} / 05`;
  $('mission-title').textContent = m.title;
  $('mission-lead').textContent = m.lead;
  $('mission-goal').textContent = m.goal;
  $('security-question').textContent = m.question;
  $('hypothesis').value = saved.notes[current]?.hypothesis || '';
  $('conclusion').value = saved.notes[current]?.conclusion || '';
  $('hints').innerHTML = m.hints.map((h, i) => `<details class="hint"><summary>Indice ${i + 1}</summary><p>${esc(h)}</p></details>`).join('');
  const fixedCode = stepOf(current) === 2;
  $('source').textContent = (fixedCode ? m.fixed : m.source) + '\n\n// Extrait simplifié pour lire l’ordre des contrôles.';
  $('code-variant').textContent = fixedCode ? 'version corrigée' : 'version initiale';
  $('app-title').textContent = m.app || '';
  $('app-kind').textContent = m.kind || '';
  $('app-help').textContent = m.help || '';
  $('read-result').hidden = true;
  if (!m.guided && target()) { buildControls(); buildInspector(); }
  paint();
  refreshState();
}

function paint() {
  const m = missions[current];
  paintWallet();
  paintNav();
  paintStepper();
  paintStepCard();
  const hasTarget = !!target() && walletStatus === 'ready';
  $('workspace').hidden = m.guided || !hasTarget;
  $('lower').hidden = m.guided;
  if (hasTarget && !m.guided) { paintAppState(); if ($('function').options.length) renderArguments(); }
  paintHistory();
  if (busy) lock(true);
}

function paintWallet() {
  const chip = $('wallet');
  chip.className = `wallet-chip ${walletStatus}`;
  if (walletStatus === 'ready') chip.innerHTML = `<span class="dot"></span><span class="w-addr">${esc(short(wallet.address))}</span>${walletBalance !== null ? `<span class="w-bal">${esc(number(walletBalance, 2))} USDT</span>` : ''}`;
  else if (walletStatus === 'wrong-network') chip.innerHTML = '<span class="dot"></span>Changer de réseau';
  else if (walletStatus === 'missing') chip.innerHTML = '<span class="dot"></span>MetaMask requis';
  else chip.innerHTML = '<span class="dot"></span>Connecter MetaMask';
  const done = missions.filter((_, i) => missionDone(i)).length;
  $('progress-text').textContent = `${done} / 5 missions`;
  $('progress-bar').style.width = `${done * 20}%`;
}

function paintNav() {
  $('missions').innerHTML = missions.map((mission, i) => {
    const o = objectives(i), done = o[1] && o[2];
    const dots = o.map(v => `<i class="${v ? 'on' : ''}"></i>`).join('');
    return `<button class="mission ${i === current ? 'active' : ''} ${done ? 'done' : ''}" data-mission="${i}" type="button" ${i === current ? 'aria-current="page"' : ''}>
      <span class="mission-num">${done ? '✓' : '0' + (i + 1)}</span>
      <span class="mission-body"><strong>${esc(mission.short)}</strong><span class="mission-dots" aria-label="${o.filter(Boolean).length} étape(s) sur 3">${dots}</span></span>
    </button>`;
  }).join('');
  $('missions').querySelectorAll('[data-mission]').forEach(b => { b.onclick = () => choose(Number(b.dataset.mission)); });
  // Sur mobile, la liste défile horizontalement : on centre la mission active sans bouger la page.
  const nav = $('missions'), active = nav.querySelector('.active');
  if (active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
}

function paintStepper() {
  const m = missions[current], step = stepOf(current), o = objectives(current);
  $('stepper').innerHTML = m.steps.map((s, i) => `<li><button type="button" class="step ${i === step ? 'current' : ''} ${o[i] ? 'complete' : ''}" data-step="${i}" ${i === step ? 'aria-current="step"' : ''}>
    <span class="step-num">${o[i] ? '✓' : i + 1}</span><span class="step-text"><small>${i === 2 && !m.guided ? 'Vérifier' : i === 0 ? 'Observer' : i === 1 ? 'Attaquer' : 'Protéger'}</small>${esc(s.label)}</span></button></li>`).join('');
  document.querySelectorAll('[data-step]').forEach(b => { b.onclick = () => goStep(Number(b.dataset.step)); });
}

function onboardingHTML() {
  const items = [
    ['MetaMask installé', walletStatus !== 'missing'],
    ['Compte connecté', walletStatus === 'ready' || walletStatus === 'wrong-network'],
    ['Réseau BaaS sélectionné', walletStatus === 'ready']
  ];
  const action = walletStatus === 'missing'
    ? '<a class="button primary" href="https://metamask.io/download/" target="_blank" rel="noopener">Installer MetaMask ↗</a>'
    : walletStatus === 'wrong-network'
      ? '<button class="button primary" id="cta-network" type="button">Passer sur le réseau BaaS</button>'
      : '<button class="button primary" id="cta-connect" type="button">Connecter MetaMask</button>';
  return `<div class="onboarding">
    <ul class="checklist">${items.map(([label, ok]) => `<li class="${ok ? 'ok' : ''}"><span aria-hidden="true">${ok ? '✓' : ''}</span>${label}</li>`).join('')}</ul>
    <div class="cta-row">${action}<span class="cta-note">Réseau privé, sans frais de gas. Rien n’est dépensé.</span></div>
  </div>`;
}

function paintStepCard() {
  const m = missions[current], step = stepOf(current), s = m.steps[step], o = objectives(current);
  const ready = walletStatus === 'ready', t = target(), state = t ? saved.states[t] : null;
  const fixed = step === 2;
  let body = '';
  if (m.guided) body += sequenceHTML(step);
  let cta = '';
  if (!ready) cta = onboardingHTML();
  else if (!t && !m.guided) {
    cta = `<div class="cta-row"><button class="button primary" id="cta-start" type="button">${fixed ? 'Préparer la version corrigée' : 'Démarrer la mission'}</button><span class="cta-note">Crée votre instance personnelle · 1 confirmation MetaMask</span></div>`;
  } else if (m.guided && !o[step]) {
    const pending = state?.completed;
    cta = pending ? '' : `<div class="cta-row"><button class="button primary big" id="guide-run" type="button">${busy ? '<span class="spinner light"></span> Confirmation en cours…' : esc(s.action)}</button><span class="cta-note">${t ? 'Votre espace est prêt · 1 confirmation MetaMask' : '2 confirmations MetaMask : préparer votre espace, puis lancer l’opération'}</span></div>`;
  }
  let result = '';
  if (m.guided && state?.completed) result = `<div class="guide-result">${resultHTML(step, state)}</div>`;
  let banner = '';
  if (ready && o[step]) {
    const next = step < 2
      ? `<button class="button primary" id="cta-next" type="button">Étape suivante : ${esc(m.steps[step + 1].label)} →</button>`
      : current < 4
        ? `<button class="button primary" id="cta-mission" type="button">Mission suivante →</button>`
        : '<button class="button primary" id="cta-export" type="button">Exporter mes observations</button>';
    const closing = step === 2 ? (m.guided
      ? `<label for="guide-answer">Pourquoi passez-vous avant la cliente ? Que change sa limite de 1 % ?</label><textarea id="guide-answer" rows="3" placeholder="Expliquez avec les résultats observés."></textarea><p class="small muted">Une tolérance de 1 % limite l’attaque. Elle ne supprime pas tous les petits sandwichs.</p>`
      : '<p class="small">Mission validée. Rédigez votre conclusion dans le carnet d’enquête avant de continuer.</p>') : '';
    banner = `<div class="done-banner"><span class="done-icon" aria-hidden="true">✓</span><div><strong>${esc(s.done)}</strong>${closing}</div><div class="done-action">${next}</div></div>`;
  }
  const meta = ready && t && !m.guided ? `<div class="instance">
      <span class="badge ${fixed ? 'fixed' : 'vuln'}">${fixed ? 'Version corrigée' : 'Version initiale'}</span>
      <span class="instance-addr">Instance <code title="${esc(t)}">${esc(short(t))}</code><button class="link" id="copy-address" type="button">Copier</button></span>
      <button class="button ghost small" id="reset" type="button" title="Crée une instance neuve pour cette étape">Recommencer</button>
    </div>` : m.guided && ready ? `<div class="instance"><span class="badge ${fixed ? 'fixed' : 'vuln'}">${fixed ? 'Tolérance 1 %' : 'Tolérance 30 %'}</span><span class="cta-note">Pool : 10 000 USDT / 10 000 DEX · frais 0,3 %</span></div>` : '';
  const extra = m.guided ? `<details class="more"><summary>Comprendre le mécanisme</summary>${mechanismHTML()}</details><details class="more"><summary>Voir les preuves et les transactions</summary><div id="guide-history"></div></details>` : '';
  $('step-card').className = `step-card ${fixed ? 'is-fixed' : ''} ${o[step] && ready ? 'is-done' : ''}`;
  $('step-card').innerHTML = `<div class="step-head"><div><p class="eyebrow">Étape ${step + 1} sur 3</p><h2>${esc(s.title || s.label)}</h2></div>${meta}</div>
    <p class="step-text-main">${esc(s.text)}</p>${body}${result}${banner || cta}${extra}`;
  if ($('cta-connect')) $('cta-connect').onclick = ensureReady;
  if ($('cta-network')) $('cta-network').onclick = ensureReady;
  if ($('cta-start')) $('cta-start').onclick = createInstance;
  if ($('reset')) $('reset').onclick = createInstance;
  if ($('cta-next')) $('cta-next').onclick = () => goStep(step + 1);
  if ($('cta-mission')) $('cta-mission').onclick = () => choose(current + 1);
  if ($('cta-export')) $('cta-export').onclick = exportReport;
  if ($('guide-run')) $('guide-run').onclick = runGuide;
  if ($('copy-address')) $('copy-address').onclick = () => navigator.clipboard.writeText(target()).then(() => toast('Adresse de l’instance copiée.', 'success')).catch(() => toast('Copie impossible : sélectionnez l’adresse.', 'error'));
  if ($('guide-answer')) { $('guide-answer').value = saved.guideAnswer || ''; $('guide-answer').oninput = () => { saved.guideAnswer = $('guide-answer').value; persist(); }; }
}

function heroHTML(s, book) {
  const label = a => a && a !== ZERO ? (book[a.toLowerCase()] || short(a)) : 'personne';
  if (current === 0) {
    const paid = s.paidTo && s.paidTo !== ZERO, to = paid ? s.paidTo : s.recipient;
    const tone = same(to, s.legitimateRecipient) ? 'ok' : 'bad';
    return `<div class="flow"><div class="flow-node"><small>Facture</small><b>10 USDT</b></div><span class="flow-arrow ${paid ? 'done' : ''}">${paid ? 'payée à' : 'sera payée à'}</span><div class="flow-node ${tone}"><small>${paid ? 'Paiement effectué' : 'Destinataire enregistré'}</small><b>${esc(label(to))}</b></div></div>`;
  }
  if (current === 1) {
    const paid = s.paidTo && s.paidTo !== ZERO;
    if (!paid) return '<div class="flow"><div class="flow-node"><small>Réserve</small><b>10 USDT</b></div><span class="flow-arrow">en attente</span><div class="flow-node"><small>Aucun paiement</small><b>—</b></div></div>';
    const name = NAMES[s.paidNameHash] || 'nom hors registre';
    const coherent = (name === 'ATELIER MARTIN' && same(s.paidTo, s.legitimateRecipient)) || (name === 'LUCAS DURAND' && same(s.paidTo, s.otherRecipient));
    return `<div class="flow"><div class="flow-node"><small>Demande au nom de</small><b>${esc(name)}</b></div><span class="flow-arrow done">10 USDT →</span><div class="flow-node ${coherent ? 'ok' : 'bad'}"><small>Versés à</small><b>${esc(label(s.paidTo))}</b></div></div>`;
  }
  if (current === 2) {
    const got = Math.round(Number(s.received || 0)), left = Math.round(Number(s.remaining || 0));
    const coins = Array.from({ length: 6 }, (_, i) => `<i class="coin ${i < got ? (i === 0 ? 'ok' : 'bad') : i < got + left ? '' : 'gone'}"></i>`).join('');
    return `<div class="vault"><div class="coins" aria-hidden="true">${coins}</div><p><b>${got} USDT</b> reçus sur <b>1</b> autorisé${Number(s.callbacks) ? ` · ${s.callbacks} passage${Number(s.callbacks) > 1 ? 's' : ''}` : ''}</p></div>`;
  }
  if (current === 3) {
    const signed = !!saved.vouchers?.[target()], times = Math.round(Number(s.totalPaid || 0) / 10);
    return `<div class="voucher ${times > 1 ? 'bad' : ''}"><div><small>Bon de remboursement · n° 1</small><b>10 USDT</b></div><div class="voucher-side"><span class="${signed ? 'ok' : ''}">${signed ? '✓ Signé' : 'Non signé'}</span><span>Encaissé ${times} fois</span></div></div>`;
  }
  return '';
}

function paintAppState() {
  const s = saved.states[target()];
  if (!s) { $('app-state').innerHTML = '<p class="muted loading">Lecture de l’état sur le réseau…</p>'; $('app-hero').innerHTML = ''; return; }
  const book = addressBook(s);
  $('app-hero').innerHTML = heroHTML(s, book);
  // Les actions déjà consommées sont signalées (l'inspecteur reste libre pour tester un refus).
  if ($('normal-pay')) { const paid = s.paidTo && s.paidTo !== ZERO; $('normal-pay').classList.toggle('spent', !!paid); $('normal-pay').textContent = paid ? 'Facture déjà payée ✓' : 'Payer la facture · 10 USDT'; }
  if ($('normal-withdraw')) { const spent = Number(s.entitlement) === 0; $('normal-withdraw').classList.toggle('spent', spent); $('normal-withdraw').textContent = spent ? 'Droit déjà utilisé ✓' : 'Retirer 1 USDT'; }
  $('app-state').innerHTML = missions[current].fields.filter(f => !f.hidden).map(f => `<div class="state-card ${f.wide ? 'wide' : ''} ${f.tone ? f.tone(s) : ''}"><span class="label">${esc(f.label)}</span><div class="value">${formatValue(f.type, s[f.key], book)}</div></div>`).join('');
}

function buildControls() {
  const html = [
    '<button id="normal-pay" class="button primary" type="button">Payer la facture · 10 USDT</button><p class="helper">Ce bouton paie le destinataire enregistré. Les autres fonctions sont dans l’inspecteur.</p>',
    '<div class="row"><button id="load-martin" class="button ghost" type="button">Charger Atelier Martin</button><button id="load-durand" class="button ghost" type="button">Charger Lucas Durand</button></div><p class="helper">Charger une entrée remplit l’inspecteur avec son nom, son adresse et sa preuve publique. Vous pouvez ensuite modifier chaque champ.</p>',
    '<button id="normal-withdraw" class="button primary" type="button">Retirer 1 USDT</button><p class="helper">Pour tester les rappels, utilisez « Retrait avec le contrat récepteur » dans l’inspecteur.</p>',
    '<div class="row"><button id="prepare-voucher" class="button ghost" type="button">Préparer le bon signé</button><button id="redeem-voucher" class="button primary" type="button">Encaisser le bon</button></div><p class="helper">La signature est conservée : vous pouvez présenter exactement le même bon plusieurs fois.</p>'
  ][current];
  $('app-controls').innerHTML = html;
  const on = (id, fn) => { if ($(id)) $(id).onclick = fn; };
  on('normal-pay', () => execute('pay', [], false));
  on('normal-withdraw', () => execute('normalWithdraw', [], false));
  on('load-martin', () => loadBeneficiary(0));
  on('load-durand', () => loadBeneficiary(1));
  on('prepare-voucher', prepareVoucher);
  on('redeem-voucher', () => { const sig = saved.vouchers?.[target()]; if (!sig) return toast('Préparez d’abord le bon signé.', 'error'); execute('redeem', [sig], false); });
}

// ---------------------------------------------------------------------------
// Inspecteur
// ---------------------------------------------------------------------------
function getFunctions() {
  const s = saved.states[target()] || {};
  const me = wallet ? [{ label: 'Vous', value: wallet.address }] : [];
  if (current === 0) return [
    { name: 'recipient', title: 'Lire le destinataire', read: true, args: [] },
    { name: 'setRecipient', title: 'Modifier le destinataire', args: [{ id: 'next', label: 'Nouvelle adresse', type: 'address', value: '', chips: [...me, s.legitimateRecipient && { label: 'Fournisseur prévu', value: s.legitimateRecipient }] }] },
    { name: 'pay', title: 'Régler la facture', args: [] }];
  if (current === 1) {
    const merkle = [
      { id: 'name', label: 'Nom du bénéficiaire', type: 'string', value: 'ATELIER MARTIN', chips: [{ label: 'ATELIER MARTIN', value: 'ATELIER MARTIN' }, { label: 'LUCAS DURAND', value: 'LUCAS DURAND' }] },
      { id: 'to', label: 'Adresse du bénéficiaire', type: 'address', value: '', chips: [s.legitimateRecipient && { label: 'Atelier Martin', value: s.legitimateRecipient }, s.otherRecipient && { label: 'Lucas Durand', value: s.otherRecipient }, ...me] },
      { id: 'proof', label: 'Preuve (tableau JSON)', type: 'proof', value: '[]', chips: [{ label: 'Preuve de Martin', proof: 0 }, { label: 'Preuve de Durand', proof: 1 }] }];
    return [
      { name: 'verifyBeneficiary', title: 'Vérifier le bénéficiaire', read: true, args: merkle },
      { name: 'pay', title: 'Envoyer le paiement', args: merkle },
      { name: 'proofFor', title: 'Lire une preuve du registre', read: true, args: [{ id: 'index', label: 'Entrée du registre', type: 'uint', value: '0', chips: [{ label: '0 · Martin', value: '0' }, { label: '1 · Durand', value: '1' }] }] }];
  }
  if (current === 2) return [
    { name: 'normalWithdraw', title: 'Retrait normal', args: [] },
    { name: 'attack', title: 'Retrait avec le contrat récepteur', args: [{ id: 'maxCallbacks', label: 'Nombre maximal de passages (1 à 6)', type: 'uint', value: '1', chips: [1, 2, 3, 6].map(n => ({ label: String(n), value: String(n) })) }] }];
  const sig = saved.vouchers?.[target()] || '';
  const sigArg = { id: 'signature', label: 'Signature du bon', type: 'string', value: sig, chips: sig ? [{ label: 'Mon bon signé', value: sig }] : [] };
  return [
    { name: 'validSignature', title: 'Vérifier la signature', read: true, args: [sigArg] },
    { name: 'redeem', title: 'Encaisser le bon', args: [sigArg] }];
}
function argStore() { const k = `${current}:${target()}`; saved.args[k] ??= {}; return saved.args[k]; }
function buildInspector() {
  const funcs = getFunctions();
  const previous = Number($('function').value) || 0;
  $('function').innerHTML = funcs.map((f, i) => `<option value="${i}">${esc(f.title)} · ${esc(f.name)}()${f.read ? ' — lecture' : ''}</option>`).join('');
  $('function').value = String(Math.min(previous, funcs.length - 1));
  $('function').onchange = () => { $('read-result').hidden = true; renderArguments(); };
  renderArguments();
}
function renderArguments() {
  const f = getFunctions()[Number($('function').value) || 0];
  if (!f) return;
  const store = argStore();
  const active = document.activeElement?.id;
  $('arguments').innerHTML = f.args.map(a => {
    const value = store[a.id] ?? a.value;
    const chips = (a.chips || []).filter(Boolean);
    const input = a.type === 'proof'
      ? `<textarea id="arg-${a.id}" data-arg="${a.id}" rows="3" spellcheck="false" class="mono">${esc(value)}</textarea>`
      : `<input id="arg-${a.id}" data-arg="${a.id}" value="${esc(value)}" ${a.type === 'uint' ? 'inputmode="numeric"' : ''} autocomplete="off" spellcheck="false" class="${a.type === 'string' && a.id !== 'name' ? 'mono' : a.type === 'address' ? 'mono' : ''}">`;
    return `<label for="arg-${a.id}">${esc(a.label)}</label>${input}${chips.length ? `<div class="chips">${chips.map((c, i) => `<button type="button" class="chip" data-chip="${a.id}:${i}">${esc(c.label)}</button>`).join('')}</div>` : ''}`;
  }).join('');
  document.querySelectorAll('[data-arg]').forEach(el => { el.oninput = () => { store[el.dataset.arg] = el.value; persist(); }; });
  document.querySelectorAll('[data-chip]').forEach(b => {
    b.onclick = async () => {
      const [id, i] = b.dataset.chip.split(':');
      const chip = f.args.find(a => a.id === id).chips.filter(Boolean)[Number(i)];
      try {
        store[id] = chip.proof !== undefined ? serialize([...(await contract.proofFor(chip.proof))]) : chip.value;
        persist(); renderArguments();
      } catch (e) { toast(explain(e), 'error'); }
    };
  });
  $('send').textContent = f.read ? 'Lire le résultat →' : 'Envoyer la transaction →';
  $('send').classList.toggle('read', !!f.read);
  if (active && $(active)) $(active).focus();
}
async function loadBeneficiary(index) {
  if (busy) return;
  try {
    const address = await contract[index === 0 ? 'legitimateRecipient' : 'otherRecipient']();
    const proof = await contract.proofFor(index);
    Object.assign(argStore(), { name: index === 0 ? 'ATELIER MARTIN' : 'LUCAS DURAND', to: address, proof: serialize([...proof]) });
    persist();
    $('function').value = '0'; renderArguments();
    toast('Entrée chargée dans l’inspecteur. Vérifiez-la avant de l’envoyer.', 'success');
    $('function').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) { toast(explain(e), 'error'); }
}
$('send').onclick = () => {
  const f = getFunctions()[Number($('function').value) || 0];
  try {
    const args = f.args.map(a => {
      const raw = $(`arg-${a.id}`).value.trim();
      if (a.type === 'address') { if (!ethers.isAddress(raw)) throw new Error('Saisissez une adresse complète : 0x suivi de 40 caractères hexadécimaux. Les boutons sous le champ la remplissent pour vous.'); return raw; }
      if (a.type === 'uint') { if (!/^\d+$/.test(raw)) throw new Error('Saisissez un entier positif ou nul.'); const n = BigInt(raw); if (current === 2 && (n < 1n || n > 6n)) throw new Error('Pour cette mission, choisissez entre 1 et 6 passages.'); return n; }
      if (a.type === 'proof') { let v; try { v = JSON.parse(raw); } catch { throw new Error('La preuve doit être un tableau JSON, par exemple ["0x…"].'); } if (!Array.isArray(v) || v.some(x => !/^0x[0-9a-fA-F]{64}$/.test(x))) throw new Error('Chaque élément de preuve doit contenir 32 octets en hexadécimal.'); return v; }
      return raw;
    });
    execute(f.name, args, !!f.read);
  } catch (e) { toast(explain(e), 'error'); }
};
async function prepareVoucher() {
  if (busy) return;
  lock(true); toast('Signez le bon dans MetaMask. Aucune transaction n’est envoyée.', '', { spin: true });
  try {
    const signature = await wallet.signTypedData(
      { name: 'Bon de remboursement', version: '1', chainId: configuration.chainId, verifyingContract: target() },
      { Bon: [{ name: 'beneficiary', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }] },
      { beneficiary: wallet.address, amount: ethers.parseEther('10'), nonce: 1 }
    );
    saved.vouchers[target()] = signature; argStore().signature = signature; persist();
    toast('Bon signé prêt : 10 USDT, numéro 1. Vous pouvez l’encaisser.', 'success');
  } catch (e) { toast(explain(e), 'error'); }
  finally { lock(false); buildInspector(); paint(); }
}

// ---------------------------------------------------------------------------
// Réseau : instances, appels, état
// ---------------------------------------------------------------------------
async function checkPending() {
  const pending = saved.pending;
  if (!pending) return false;
  const receipt = await provider.getTransactionReceipt(pending.hash);
  if (!receipt) throw new Error(`Une transaction attend encore sa confirmation (${short(pending.hash)}). Attendez puis réessayez : aucune nouvelle transaction n’a été envoyée.`);
  if (pending.operation === 'create' && receipt.status === 1) {
    const iface = new ethers.Interface(abi.factory);
    const event = receipt.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).find(l => l?.name === 'MissionCreated' && same(l.args.player, wallet.address));
    if (!event) throw new Error('Création confirmée mais événement absent. Conservez le hash et contactez le formateur.');
    saved.instances[pending.key] = event.args.target;
  }
  const entry = saved.history.find(e => e.transactionHash === pending.hash);
  if (entry) { entry.success = receipt.status === 1; entry.receiptStatus = receipt.status; entry.blockNumber = receipt.blockNumber; entry.outcome = receipt.status === 1 ? 'Confirmé' : 'Refusé'; entry.events = decodeLogs(receipt.logs); delete entry.error; }
  delete saved.pending; persist(); render();
  toast(receipt.status === 1 ? 'La transaction précédente est confirmée. Son résultat est disponible.' : 'La transaction précédente a été refusée par le contrat.', receipt.status === 1 ? 'success' : 'error');
  return true;
}
async function createInstance() {
  if (busy) return;
  if (!await ensureReady()) return;
  lock(true); toast('Confirmez la création dans MetaMask…', '', { spin: true });
  const stepKey = key(), fixed = stepOf(current) === 2;
  try {
    if (await checkPending()) return;
    const network = await browserProvider.send('eth_chainId', []);
    if (BigInt(network) !== BigInt(configuration.chainId)) throw new Error('Le réseau ne correspond pas au laboratoire.');
    const factoryAddress = current === 4 ? configuration.sandwichFactory : current === 3 ? configuration.replayFactory : configuration.factory;
    const factory = new ethers.Contract(factoryAddress, abi.factory, wallet);
    const tx = await factory.createMission(current, fixed, { gasPrice: 0, gasLimit: 7000000 });
    saved.pending = { hash: tx.hash, key: stepKey, operation: 'create' }; persist();
    toast('Préparation de votre instance sur le réseau…', '', { spin: true });
    const receipt = await tx.wait(1, 90000);
    if (receipt.status !== 1) throw new Error('La création a été annulée par le contrat.');
    const event = receipt.logs.map(l => { try { return factory.interface.parseLog(l); } catch { return null; } }).find(l => l?.name === 'MissionCreated' && same(l.args.player, wallet.address));
    if (!event) throw new Error('La transaction est confirmée mais l’adresse de l’instance est introuvable. Conservez son hash.');
    saved.instances[stepKey] = event.args.target; delete saved.pending; persist();
    toast(fixed ? 'Version corrigée prête. Rejouez votre attaque.' : 'Votre instance est prête.', 'success');
  } catch (e) { if (e.receipt) { delete saved.pending; persist(); } toast(explain(e), 'error'); }
  finally { lock(false); render(); }
}
const receiptInterface = new ethers.Interface(['event Step(uint8 indexed order,string actor,uint256 spent,uint256 received)', 'event CustomerBlocked(uint256 minimum)', 'event Swap(address indexed recipient,bool buy,uint256 input,uint256 output)', 'event VoucherPaid(bytes32 indexed voucherId,address indexed beneficiary,uint256 amount)', 'event Payment(address indexed recipient,uint256 amount)', 'event Payment(address indexed recipient,bytes32 nameHash,bool proofValid,uint256 amount)', 'event RecipientChanged(address indexed caller,address indexed recipient)', 'event Withdrawal(address indexed recipient,uint256 amount)', 'event Transfer(address indexed from,address indexed to,uint256 value)']);
function decodeLogs(logs) { return logs.map(log => { try { const event = receiptInterface.parseLog(log); return event ? { contract: log.address, event: event.name, values: Object.fromEntries(event.fragment.inputs.map((input, index) => [input.name || String(index), display(event.args[index])])) } : null; } catch { return null; } }).filter(Boolean); }

async function snapshot() {
  if (!contract) return {};
  const token = new ethers.Contract(await contract.token(), abi.token, provider);
  const balance = async a => credits(await token.balanceOf(a));
  if (current === 0) { const [administrator, recipient, legitimateRecipient, paidTo] = await Promise.all([contract.administrator(), contract.recipient(), contract.legitimateRecipient(), contract.paidTo()]); return { administrator, recipient, legitimateRecipient, paidTo, player: wallet.address, playerCredits: await balance(wallet.address), contractCredits: await balance(target()) }; }
  if (current === 1) { const [root, legitimateRecipient, otherRecipient, paidTo, paidNameHash] = await Promise.all([contract.root(), contract.legitimateRecipient(), contract.otherRecipient(), contract.paidTo(), contract.paidNameHash()]); return { root, legitimateRecipient, otherRecipient, paidTo, paidNameHash, martinCredits: await balance(legitimateRecipient), durandCredits: await balance(otherRecipient), contractCredits: await balance(target()) }; }
  if (current === 3) return { voucherId: await contract.voucherHash(), totalPaid: credits(await contract.totalPaid()), used: await contract.used(), reserve: await balance(target()) };
  if (current === 4) { const [baseline, received, shortfall, profit, completed, executed, tolerance, minimum, customer, attacker, pool, amount, sale] = await Promise.all([contract.baseline(), contract.customerReceived(), contract.customerShortfall(), contract.attackerProfit(), contract.completed(), contract.customerExecuted(), contract.toleranceBps(), contract.minimumReceived(), contract.customer(), contract.attacker(), contract.pool(), contract.attackAmount(), contract.attackerSale()]); return { baseline: credits(baseline), received: credits(received), shortfall: credits(shortfall), profit: credits(profit), completed, executed, tolerance: Number(tolerance) / 100, minimum: credits(minimum), customerUSDT: await balance(customer), attackerUSDT: await balance(attacker), pool, customer, attacker, amount: credits(amount), sale: credits(sale) }; }
  const [remaining, received, callbacks, entitlement, receiver, bank] = await Promise.all([contract.remaining(), contract.received(), contract.callbacks(), contract.entitlement(), contract.receiver(), contract.bank()]);
  return { remaining: credits(remaining), received: credits(received), callbacks: callbacks.toString(), entitlement: credits(entitlement), receiver, bank };
}
async function refreshState() {
  const t = target(), mi = current;
  if (!t || walletStatus !== 'ready' || !contract) return;
  try {
    const s = await snapshot();
    saved.states[t] = s; persist();
    if (target() === t && current === mi) paint();
  } catch (e) { toast(explain(e), 'error'); }
}

async function execute(name, args, read) {
  if (busy) return;
  lock(true);
  if (missions[current].guided) paintStepCard();
  toast(read ? 'Lecture du contrat…' : 'Confirmez l’opération dans MetaMask…', '', { spin: true });
  const step = stepOf(current);
  const entry = { mission: missions[current].short, kind: current, step, variant: step === 2 ? 'fixed' : 'vulnerable', target: target(), function: name, arguments: display(args), at: new Date().toISOString() };
  try {
    if (await checkPending()) { lock(false); return; }
    entry.before = await snapshot();
    if (read) {
      entry.result = display(await contract[name](...args)); entry.success = true;
      showReadResult(name, entry.result);
      toast('Réponse du contrat reçue.', 'success');
    } else {
      const tx = await contract[name](...args, { gasPrice: 0, gasLimit: 2000000 });
      entry.transactionHash = tx.hash; saved.pending = { hash: tx.hash, key: key(), operation: 'call' }; persist();
      toast('Transaction envoyée. Confirmation en cours…', '', { spin: true });
      const receipt = await tx.wait(1, 90000);
      entry.success = receipt.status === 1; entry.receiptStatus = receipt.status; entry.blockNumber = receipt.blockNumber; entry.gasUsed = receipt.gasUsed.toString();
      entry.events = decodeLogs(receipt.logs);
      entry.logs = receipt.logs.map(l => ({ address: l.address, topics: l.topics, data: l.data }));
      delete saved.pending; persist();
      toast('Transaction confirmée. Regardez ce qui a changé dans les preuves.', 'success');
    }
  } catch (e) {
    entry.success = e.receipt?.status === 0 ? false : null;
    entry.error = explain(e);
    entry.outcome = e.receipt?.status === 0 ? 'Refusé' : (e.code === 'ACTION_REJECTED' || e.code === 4001) ? 'Non envoyé' : 'Indéterminé';
    if (e.receipt) { entry.transactionHash = e.receipt.hash; entry.blockNumber = e.receipt.blockNumber; entry.receiptStatus = e.receipt.status; delete saved.pending; }
    if (entry.outcome === 'Refusé') {
      // Le reçu ne contient pas la raison : on rejoue l'appel en lecture pour la récupérer.
      try { await contract[name].staticCall(...args); } catch (x) { if (x.reason) entry.error = `Raison donnée par le contrat : « ${x.reason} »`; }
    }
    toast((entry.outcome === 'Refusé' ? 'Le contrat a refusé l’appel. ' : entry.outcome === 'Non envoyé' ? '' : 'Appel non confirmé. ') + entry.error, entry.outcome === 'Non envoyé' ? '' : 'error');
  }
  try { entry.after = await snapshot(); saved.states[entry.target] = entry.after; } catch (e) { entry.stateReadError = explain(e); }
  if (entry.outcome !== 'Non envoyé') saved.history.push(entry);
  persist(); lock(false); paint(); refreshBalance();
  if (!read) document.querySelector(missions[current].guided ? '#step-card' : '.evidence')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function showReadResult(name, result) {
  const box = $('read-result');
  let text, tone = '';
  if (typeof result === 'boolean') { text = result ? 'vrai ✓' : 'faux ✗'; tone = result ? 'ok' : 'bad'; }
  else if (typeof result === 'string' && ethers.isAddress(result)) text = formatValue('address', result, addressBook(saved.states[target()] || {}));
  else text = `<code>${esc(serialize(result))}</code>`;
  box.className = `read-result ${tone}`;
  box.innerHTML = `<span class="label">Réponse de ${esc(name)}()</span><div class="value">${typeof result === 'boolean' ? esc(text) : text}</div>`;
  box.hidden = false;
}

// ---------------------------------------------------------------------------
// Parcours guidé (mission 5)
// ---------------------------------------------------------------------------
let guideRunning = false;
async function runGuide() {
  if (busy || guideRunning) return;
  guideRunning = true;
  try {
    if (!await ensureReady()) return;
    try { await checkPending(); } catch (e) { toast(explain(e), 'error'); return; }
    if (!target()) await createInstance();
    if (!target() || saved.pending) return;
    useContract();
    const state = await snapshot().catch(e => { toast(explain(e), 'error'); return null; });
    if (!state) return;
    saved.states[target()] = state; persist();
    if (state.completed) { paint(); return; }
    await execute(stepOf(4) === 0 ? 'runNormal' : 'runSandwich', stepOf(4) === 0 ? [] : [1000n], false);
  } finally { guideRunning = false; if (busy) lock(false); paint(); }
}

// ---------------------------------------------------------------------------
// Preuves
// ---------------------------------------------------------------------------
function diffRows(e) {
  if (!e.before || !e.after) return '';
  const book = addressBook(e.after);
  const rows = missions[e.kind].fields.filter(f => serialize(e.before[f.key]) !== serialize(e.after[f.key]));
  if (!rows.length) return '<p class="nochange">Aucun changement d’état.</p>';
  return `<ul class="diff">${rows.map(f => `<li><span>${esc(f.label)}</span><span class="from">${formatValue(f.type, e.before[f.key], book)}</span><span class="arrow">→</span><span class="to">${formatValue(f.type, e.after[f.key], book)}</span></li>`).join('')}</ul>`;
}
const stepNames = ['Normal', 'Attaque', 'Corrigée'];
function evidenceHTML(entries) {
  if (!entries.length) return '<p class="empty">Vos appels apparaîtront ici, avec ce qu’ils ont changé.</p>';
  return entries.map(e => {
    const ok = e.success, label = ok ? (e.transactionHash ? 'Confirmé' : 'Lu') : (e.outcome || 'Refusé');
    const pv = proofValid(e);
    const result = e.result !== undefined ? `<p class="evidence-result">Réponse : <b>${typeof e.result === 'boolean' ? (e.result ? 'vrai' : 'faux') : esc(Array.isArray(e.result) ? serialize(e.result) : short(String(e.result)))}</b></p>` : '';
    return `<article class="evidence-item ${ok ? 'ok' : ok === false ? 'bad' : 'unknown'}">
      <div class="evidence-top"><span class="ev-dot" aria-hidden="true"></span><strong><code>${esc(e.function)}()</code></strong><span class="pill">${stepNames[e.step ?? (e.variant === 'fixed' ? 2 : 0)]}</span><span class="result ${ok ? '' : 'failed'}">${esc(label)}</span></div>
      <p class="ev-meta">${e.transactionHash ? 'Transaction' : 'Lecture'} · ${esc(new Date(e.at).toLocaleTimeString('fr-FR'))}${e.blockNumber ? ' · bloc ' + e.blockNumber : ''}${e.transactionHash ? ` · <code title="${esc(e.transactionHash)}">${esc(short(e.transactionHash))}</code>` : ''}</p>
      ${result}${pv !== undefined ? `<p class="selection ${pv ? '' : 'bad'}">Preuve acceptée par le contrat : <b>${pv ? 'oui' : 'non'}</b></p>` : ''}
      ${e.error ? `<p class="error-detail">${esc(e.error)}</p>` : ''}
      ${e.transactionHash ? diffRows(e) : ''}
      <details><summary>Détails techniques${e.events?.length ? ` · ${e.events.length} événement${e.events.length > 1 ? 's' : ''}` : ''}</summary><pre>${esc(serialize({ instance: e.target, arguments: e.arguments, receiptStatus: e.receiptStatus, events: e.events, before: e.before, after: e.after }))}</pre></details>
    </article>`;
  }).join('');
}
function paintHistory() {
  const html = evidenceHTML(saved.history.filter(e => e.kind === current).slice().reverse());
  $('history').innerHTML = html;
  if ($('guide-history')) $('guide-history').innerHTML = html;
}

// ---------------------------------------------------------------------------
// Navigation, export, événements
// ---------------------------------------------------------------------------
function choose(index) {
  if (busy || !Number.isInteger(index) || index < 0 || index > 4) return;
  current = index;
  history.replaceState(null, '', `#mission-${index + 1}`);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goStep(i) {
  if (busy) return;
  saved.steps[current] = Math.max(0, Math.min(2, i)); persist();
  render();
  $('stepper').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function exportReport() {
  const report = { title: 'Blockchain sécurité TP', exportedAt: new Date().toISOString(), network: configuration.chainId, player: wallet?.address || null, progress: missions.map((m, i) => ({ mission: m.short, steps: objectives(i), done: missionDone(i) })), instances: saved.instances, notes: saved.notes, observations: saved.history, sandwichAnswer: saved.guideAnswer || '' };
  const url = URL.createObjectURL(new Blob([serialize(report)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'mes-observations-blockchain.json'; a.click(); URL.revokeObjectURL(url);
  toast('Fichier exporté : mes-observations-blockchain.json', 'success');
}
function saveNotes() { saved.notes[current] = { hypothesis: $('hypothesis').value, conclusion: $('conclusion').value }; persist(); }
['hypothesis', 'conclusion'].forEach(id => $(id).addEventListener('input', saveNotes));
$('export').onclick = exportReport;
$('refresh').onclick = async () => { try { if (await checkPending()) return; await refreshState(); toast('État actualisé depuis le réseau.', 'success'); } catch (e) { toast(explain(e), 'error'); } };

$('wallet').onclick = () => {
  if (walletStatus !== 'ready') return ensureReady();
  const menu = $('wallet-menu'), open = menu.hidden;
  menu.innerHTML = `<p class="label">Compte connecté</p><code class="full">${esc(wallet.address)}</code>
    <button type="button" class="menu-item" id="w-copy">Copier l’adresse</button>
    <button type="button" class="menu-item" id="w-token">Afficher l’USDT dans MetaMask</button>
    <p class="small muted">Réseau BaaS · ${configuration.chainId}</p>`;
  menu.hidden = !open; $('wallet').setAttribute('aria-expanded', String(open));
  $('w-copy').onclick = () => navigator.clipboard.writeText(wallet.address).then(() => toast('Adresse copiée.', 'success'));
  $('w-token').onclick = () => window.ethereum.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: configuration.token, symbol: 'USDT', decimals: 18 } } }).catch(e => toast(explain(e), 'error'));
};
document.addEventListener('click', e => { if (!e.target.closest('.wallet-wrap')) { $('wallet-menu').hidden = true; $('wallet').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('wallet-menu').hidden = true; $('toast').hidden = true; } });

if (configuration.notionUrl) { $('notion-link').href = configuration.notionUrl; $('notion-link').hidden = false; }
window.addEventListener('hashchange', () => { const match = location.hash.match(/^#mission-([1-5])$/); if (match && !busy) choose(Number(match[1]) - 1); });

render();
connect(false).then(ok => { if (ok) render(); else paint(); }).catch(e => { toast(explain(e), 'error'); paint(); });
