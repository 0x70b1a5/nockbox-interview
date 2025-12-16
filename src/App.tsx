import './index.css';
import { useNockchain } from "./hooks/useNockchain";
import { ConnectButton } from "./components/ConnectButton";
import { trimAddress } from "./utils/truncate";
import { MultisigTxBuilder } from './components/MultisigTxBuilder';

function App() {
  const { nockchain, pkh, grpcEndpoint, errors, deleteError } = useNockchain();

  return <>
    <main className="flex flex-col items-center justify-center h-screen max-w-xl mx-auto  relative bg-iris-white">
      <h1 className="text-4xl font-bold shadow-lg self-stretch p-6 text-center bg-iris-white">It's Nockbox Interview!</h1>
      <div className="flex flex-col items-center justify-center grow self-stretch">
        {pkh && <div>Your PKH: {trimAddress(pkh)}</div>}
        {grpcEndpoint && <div>Endpoint: {grpcEndpoint}</div>}
        <MultisigTxBuilder />

        </div>
    </main>
    <div className="absolute bottom-0 left-0 p-2 flex flex-col gap-2">
      {Object.values(errors).map((err, i) => <div
        key={i}
        className="bg-red-500 text-iris-white px-1 rounded-full flex gap-1 text-xs"
      >
        <span>
        {err.slice(0, 100) + (err.length > 100 ? '...' : '')}
        </span>
        <button
          onClick={() => {
            deleteError(i);
          }}>
            x
        </button>
      </div>)}
    </div>
    <ConnectButton />
  </>
}

export default App
