import { useNockchain } from "../hooks/useNockchain";
import classNames from "classnames";

export function ConnectButton() {
    const { nockchain, addError } = useNockchain();

    return (
        <button
            className={classNames("absolute bottom-2 right-2 text-xl text-iris-white px-4 py-2 rounded-md shadow-md", {
                "bg-green-500": nockchain?.isConnected,
                "bg-iris-yellow": !nockchain?.isConnected,
            })}
            onClick={() => {
                if (nockchain?.isConnected) {
                    nockchain?.dispose();
                } else {
                    nockchain?.connect();
                }
            }}
        >
            {nockchain?.isConnected ? 'Disconnect' : 'Connect'} Wallet
        </button>
    );
}