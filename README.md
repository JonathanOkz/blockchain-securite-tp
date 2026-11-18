# Blockchain sécurité · Le laboratoire

Cinq missions de cybersécurité blockchain à faire dans le navigateur avec MetaMask :

1. **Contrôle d’accès** : qui peut changer le destinataire d’un paiement ?
2. **Paiement & Merkle** : une preuve refusée bloque-t-elle le paiement ?
3. **Réentrance** : un retrait peut-il en déclencher plusieurs ?
4. **Rejeu de signature** : encaisser deux fois le même bon.
5. **Attaque sandwich** : faire payer plus cher l’achat d’une cliente.

Chaque mission suit trois étapes : **fonctionnement normal**, **attaque**, **version corrigée**. Les contrats sont créés pour vous sur le réseau BaaS privé, sans frais de gas.

## Lancer le laboratoire sur votre ordinateur

Il vous faut :

- un navigateur avec l’extension [MetaMask](https://metamask.io/download/) ;
- **Python 3** (déjà présent sur macOS et la plupart des Linux) **ou** [Node.js](https://nodejs.org/).

### 1. Récupérer le site

```bash
git clone https://github.com/JonathanOkz/blockchain-securite-tp.git
cd blockchain-securite-tp
```

Sans Git : bouton **Code → Download ZIP** sur cette page, puis décompressez le dossier et ouvrez un terminal dedans.

### 2. Démarrer le serveur local

macOS / Linux :

```bash
python3 -m http.server 8000 --directory site
```

Windows :

```bash
py -m http.server 8000 --directory site
```

Avec Node.js, sur tous les systèmes :

```bash
npx serve site -l 8000
```

### 3. Ouvrir le laboratoire

Ouvrez **http://localhost:8000** dans le navigateur où MetaMask est installé, puis cliquez sur **Connecter MetaMask**.

Si MetaMask n’est pas sur le bon réseau, cliquez sur **Passer sur le réseau BaaS** : le site l’ajoute pour vous.

| Réglage | Valeur |
|---|---|
| Réseau | BaaS Euro-Information |
| Chain ID | 5270950013 |
| RPC | https://euro-information.rpc.baas.sh |

Laissez le terminal ouvert pendant la séance. Pour arrêter le serveur : `Ctrl + C`.

## Bon à savoir

- **Double-cliquer sur `index.html` ne fonctionne pas** : le navigateur bloque les modules JavaScript ouverts depuis le disque. Passez toujours par le serveur local.
- **Votre progression** (étapes validées, notes, instances) est enregistrée dans votre navigateur, pour votre compte MetaMask. Gardez la même adresse (`http://localhost:8000`) d’une séance à l’autre pour la retrouver.
- **Exporter mes observations** télécharge un fichier JSON avec vos notes et vos transactions : c’est ce que vous rendez.
- Les transactions sont réelles, mais sur un réseau privé de test : aucun fonds réel n’est en jeu.

## Contenu

```
site/
├── index.html          page du laboratoire
├── app.js              logique des missions et appels aux contrats
├── sandwich-guide.js   parcours guidé de la mission 5
├── style.css
├── config.json         adresses des contrats et du réseau
└── vendor/ethers.min.js   bibliothèque ethers.js (licence MIT)
```
