import Utils from "../Utils.js";
import Ux from "../Ux.js";
import PaymentManager from "../PaymentManager.js";
import Tasks from "../Tasks.js";
export default class Stage1 {
    async close() {
        clearInterval(this.loadingTextInt);
        this.stageEl.remove();
    }
    async show(config, payData, cntEl) {
        
        Tasks.completable("loadingStage1","Preparing your donation...");
        const messageLoop = [
            "Contacting the backend...",
            "Retrieving data...",
            "Loading... this might take a while... ",
            "Computing routes...",
            "Waking up the bots...",
            "Dusting the CPU...",
            "Building bridges..",
            "Computing the Bits...",
            "Finding addresses..."

        ];
        this.stageEl = cntEl.appendChild(Utils.html(`
            <div class="stage">
                <p>
                    <br />
                    <br />
                    <h3><i class="fa-solid fa-bounce fa-bolt"></i></h3>
                </p>
            </div>    
        `));

        Ux.setSubtitle("Loading...");
        this.loadingTextInt = setInterval(() => {
            Ux.setSubtitle(messageLoop[Math.floor(Math.random() * messageLoop.length)]);
        }, 4000);


        let preparedPayData=Utils.clone(payData);
        try {
            clearInterval(this.loadingTextInt);
            await PaymentManager.prepare(preparedPayData);
            let totalSats = 0;
            for (const target of preparedPayData.targets) {
                totalSats += target.sats;
            }
            if (totalSats > preparedPayData.sats) {
                return Tasks.error("input-invalid","Error. The summatory of each target paid amount exceed the total amount. " + totalSats + " but " + preparedPayData.sats + " is expected.");
            } else {
                await PaymentManager.start(preparedPayData);
                await Ux.showStage(2, config, preparedPayData);
                Tasks.ok("loadingStage1");

            }
        } catch (e) {
            console.error(e);
            Tasks.error("loadingStage1","Error: "+e);
            await Ux.showStage(0, config, payData);

        }
    }
}