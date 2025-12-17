# Nockbox Interview: Multisig

Making an interface for users to create, sign, and send multisig transactions over Nockchain.

## Setup

- Have the Envoy RPC server running (https://github.com/nockbox/iris-rs/tree/main/crates/iris-wasm) and make sure you configure `envoy.yaml` to point to `localhost` and a port of your choosing
- Have a local fakenet (https://github.com/nockchain/nockchain) (make sure you confirm your wallet is set correctly and that it has a nonzero balance)
- Mine some NOCK on the fakenet
- Build Iris Wallet with the RPC_ENDPOINT constant configured to your local Envoy server (https://github.com/nockbox/iris)
- Install Iris to your browser (per the instructions in the Iris repo)
- `npm i`, `npm run dev` in this project
- open `localhost:5173` in your browser
- you should be prompted to open a wallet in your modified Iris - use existing, and paste the seedphrase for the wallet in your fakenet
- you should see your balance on the webpage now
- Add as many PKHs as you like (for wallets you control on the fakenet)
- This is the fun part: paste their mnemonic phrases in.
    - I know... I know... it's a demo.
- Your tx should now submit and be acknowledged, showing as pending on the page until the next block is mined.