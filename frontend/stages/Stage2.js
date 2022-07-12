import Utils from "../Utils.js";
import Ux from "../Ux.js";
import Tasks from "../Tasks.js";
export default class Stage2 {
    async close(){
        this.stageEl.remove();
    }
    //  async download(data, filename, type) {
    //     var file = new Blob([data], {type: type});
    //     if (window.navigator.msSaveOrOpenBlob) // IE10+
    //         window.navigator.msSaveOrOpenBlob(file, filename);
    //     else { // Others
    //         var a = document.createElement("a"),
    //                 url = URL.createObjectURL(file);
    //         a.href = url;
    //         a.download = filename;
    //         document.body.appendChild(a);
    //         a.click();
    //         setTimeout(function() {
    //             document.body.removeChild(a);
    //             window.URL.revokeObjectURL(url);  
    //         }, 0); 
    //     }
    // }
    async show(config,payData,cntEl){
        Ux.setSubtitle("Your donation is almost ready");
        this.stageEl=cntEl.appendChild(Utils.html(`
            <div class="stage">
            <hr/>
            <br />  

                <h3>LNDHub</h3>
                <br />  
                This app will use the following <b>LNDHub</b> instance to generate 
                the temporary wallet needed to process the donation 
                <br />
                <i id="lndhub">${payData.lndhub}</i> <button id="changelndhub">Use another instance</button>
                <br />
                <hr/>
                <br />
                <h3>Backup your invoice</h3>
                <br />
                Please download the invoice for your donation from the button below and keep it somewhere safe.
                This will allow you to recover the state of your donation at any time and from any device
                <br />
                <button id="downloadInvoice" class="selected">Download Invoice</button>
                <br />
                A copy of the donation invoice will be saved also to your browser's local storage.
                <br /><br />
                <hr />
                <b>Note: Since donations are processed client-side, we do not have a way to access these informations.</b>
                <hr />
                <br />

                
                <button id="continue" class="bigButton">Continue <i class="fas fa-angle-right"></i></button>
            </div>
        `));
        

        this.stageEl.querySelector("#downloadInvoice").addEventListener("click",()=>{
            Utils.download(JSON.stringify(payData,null, 2),"invoice"+Date.now()+".json","application/json");
        });
        
        this.stageEl.querySelector("#changelndhub").addEventListener("click",()=>{
            let lndhubUrl = prompt("Please enter the URL of the LNDHub instance. Note: the resource needs to allow CORS requests.", payData.lndhub);
            if(lndhubUrl){
                payData.lndhub=lndhubUrl;
                Tasks.ok("lndhub","LNDHub url updated. Please download the invoice again.");
            }
        });

        this.stageEl.querySelector("#continue").addEventListener("click",async ()=>{
            await Ux.backupPayData(payData);
            await Ux.setPayData(payData);
            await Ux.showStage(3,config,payData);

        });
    }
}