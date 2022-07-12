import PaymentManager from "../PaymentManager.js";
import Utils from "../Utils.js";
import Ux from "../Ux.js";
import VanillaQR from "../thirdparty/VanillaQR.js";
import DeepLink from "../thirdparty/DeepLink.js";
import OpencollectiveRouter from "../OpencollectiveRouter.js";
import Tasks from "../Tasks.js";
export default class Stage3 {
    async close(){
        if(this.stageEl)this.stageEl.remove();
    }
     async show(config, payData, cntEl) {
        this.config = config;
        this.targetId=0;
        this.fundingLoaded=false;
        Ux.setSubtitle("Please fund your donation by paying the following lightning invoice");
        this.stageEl=cntEl.appendChild(Utils.html(`
            <div class="stage">
                <div id="fundingInvoice">
                    
                    <h3><i class="fa-solid fa-bounce fa-bolt"></i></h3>


                    <div class="qrcontainer" id="invoiceQr">
                    <p>Please wait while the invoice is being generated </p>
                    <h3> <i class="fa-solid fa-spin   fa-cog"></i></h3>

                    </div>
                    <input type="text" id="invoiceText" radonly>
                    <button id="invoiceBtn">Open with Wallet</button>

                </div>

                <div id="balance"></div>
                <hr>
                <h3 id="status"><i class="fa fa-cog  fa-spin"></i> Loading...</h3>
                <hr>
                <table id="invoiceList"></table>
                <a id="reportIssue" >Report an issue</a>
            </div>
        `));

        this.stageEl.querySelector("#reportIssue").addEventListener("click",()=>{
            const invoice=JSON.stringify(Utils.anonimizeInvoice(payData),null, 2);
            const reportEl=Utils.html(`
            <h1>Issue report</h1>
            <h3>Short description of the issue</h3>
            <textarea id="body" style="width:100%;height:10vh;min-height:50px" placeholder="Write a short description of your issue"></textarea>
            <br >
            <br >
            <h3>Anonimized Invoice</h3>
            Here you can review and edit the anonimized invoice that will be attached to your report for debugging purposes.
            <br >
            <span class="warn">Please, never share a non-anonimized invoice downaloaded in the previous steps with anyone as it can be used to obtain 
            informations regarding your donation and to withdraw the funds of the pending donations.</span>
            <br>
            <textarea id="report" style="width:100%;height:20vh;min-height:50px;max-height:100vh">${invoice}</textarea>
            
            `);
            const bodyTxEl=reportEl.querySelector("#body");
            const reportTxEl=reportEl.querySelector("#report");
            Tasks.completable("reportIssue",reportEl,undefined,[
             
                {'<i class="fa-solid fa-bug"></i> Report':()=>{
                    let report=config.issueReportUrl.replace("%BODY%",encodeURIComponent(bodyTxEl.value));
                    report=report.replace("%INVOICE%",encodeURIComponent(reportTxEl.value));
                    window.open(report);
                    Tasks.ok("reportIssue");
                }},
                {'<i class="fa-solid fa-x"></i> Cancel':()=>{
                    Tasks.ok("reportIssue");
                }}
            ]);

        });

        if(!this.loop){
            this.loop = async () => {
                await PaymentManager.process(payData)
                setTimeout(this.loop, 2000);
            };
            this.loop();
        }
        if(!this.loop1){
            this.loop1 = async () => {
                await this.process(payData);
                setTimeout(this.loop1, 400);
            };
            this.loop1();
        }
    }

     async process(payData) {
        await this.loadProcessingState(payData);
        const balanceEl=this.stageEl.querySelector("#balance");
        balanceEl.innerHTML = `
        <table>
        <tr><th>Remaining Balance</th><th>Donation Size</th></tr>
        <tr><td><h3>${ await PaymentManager.getBalance(payData) } SATS</h3></td><td><h3>${payData.sats} SATS</h3></td></tr>
        <tr><td style="margin:0;padding:0;" colspan=2><button id="withdraw" class="bigButton">Withdraw Remaining</button></td></tr>
        </table>
        <div class="warn">${payData.fee} SATS have been reserved to pay for transaction fees.<br />
        
        ${payData.donateExtraFee?`Unspent fees will be donated to ${payData.donateExtraFee}`:
        `Unspent fees can be withdrawn`} </div>
      
        `;

        

        const withdrawBtnEl=balanceEl.querySelector("#withdraw");
        withdrawBtnEl.addEventListener("click",async ()=>{
            if(!payData.complete){
                const cnt=await new Promise((res,rej)=>{
                    Tasks.completable("withdrawPending",`The donation is still in progress. 
                    Withdrawing funds will cause pending invoices to be cancelled. `,undefined,[
                       
                        {'<i class="fa-solid fa-check"></i> Continue':()=>{
                            Tasks.ok("withdrawPending");
                            res(true);
                        }},
                        {'<i class="fa-solid fa-x"></i> Cancel':()=>{
                            Tasks.ok("withdrawPending");
                            res(false);
                        }}
                    ]);
                });
                if(!cnt)return;
            
            }
            const withdrawEl=Utils.html(`From here you can withdraw undisbursed funds. 
            This can be used to withdraw the unspent fee reserve or if a transaction is stuck.
            Input the withdrawing invoice: 
            <br>
            <br>
            <input style="width:90%" type="text" id="invoice">
            <span class="warn">You might need to leave some sats for transaction fees</span>`);
            const invoiceEl=withdrawEl.querySelector("#invoice");

            Tasks.completable("withdrawing",withdrawEl,undefined,[
               
                {'<i class="fa-solid fa-money-bill-transfer"></i> Withdraw':async ()=>{
                    try{
                        Tasks.completable("withdrawing","Withdrawing in progress...")
                        await PaymentManager.withdraw(payData,invoiceEl.value);
                        Tasks.ok("withdrawing","Invoice sent.");
                    }catch(e){
                        Tasks.fail("withdrawing","Invalid invoice? "+e);
                    }
                }},
                {'<i class="fa-solid fa-x"></i> Cancel':()=>{
                    Tasks.ok("withdrawing");
                }}
            ]);
        });

        if (payData.funded) {
            this.stageEl.querySelector("#fundingInvoice").classList.add("hidden");
            Ux.setSubtitle("");

        } else {
            await this.loadFundingRequest(payData);
           
        }
    }

     async loadFundingRequest(payData) {
        if(this.fundingLoaded)return;


        const fundingInvoiceEl=this.stageEl.querySelector("#fundingInvoice");
        const qr = new VanillaQR({
            url: "lightning:" + payData.invoice,
            size: 512,
            colorLight: "#ffffff",
            colorDark: "#000000",
            toTable: false,
            ecclevel: 1,
            noBorder: true
        });

        const qrContainer = fundingInvoiceEl.querySelector("#invoiceQr");
        qrContainer.innerHTML="";
        qrContainer.appendChild(qr.toImage("jpg"));

        const invoiceEl =fundingInvoiceEl.querySelector("#invoiceText");
        invoiceEl.value=payData.invoice;
        invoiceEl.addEventListener("click", () => {
            invoiceEl.focus();
            invoiceEl.select();
            document.execCommand('copy');
            Tasks.ok("clipboard","Copied to clipboard");

        });

        const payWithWalletEl = fundingInvoiceEl.querySelector("#invoiceBtn");
        payWithWalletEl.addEventListener("click", async () => {
            let webln;
            try{
                webln = await WebLN.requestProvider();
            }catch(e){
                console.error(e);
            }
            if (webln) {
                webln.sendPayment(payData.invoice);
            } else {
                const invoiceUri = 'lightning:' + payData.invoice;
                if (!await DeepLink.check(invoiceUri)) {
                    Tasks.error("error","Lightning wallet not found.");
                }else{
                    Tasks.ok("sentLNInvoice","Lightning payment sent.");
                }
                window.open(invoiceUri);
            }
        });

        this.fundingLoaded=true;
    }



     async loadProcessingState(payData) {
         const invoiceListEl=this.stageEl.querySelector("#invoiceList");
         payData.failed=true; // reset flag
         let routingComplete=undefined;

        for (const target of payData.targets) {
            if (!target.invoice&&!target.status||(!target.sats)) continue;
            if (!target.elementId2) target.elementId2 = `target-${this.targetId++}`
            let targetEl = invoiceListEl.querySelector(`#${target.elementId2}`);
            if (!targetEl) {
                invoiceListEl.appendChild(
                    Utils.html(`<tr><th>${target.description}</th></tr>`,"tbody")

                );
                    //                        <b>Type: </b> <span title="${target.route}">${target.type}</span>

                let targetsHtml=`  
                <tr id="${target.elementId2}">
                    <td>
                `;
                if(target.addr){
                    targetsHtml+=`
                        <b>Lightning Address: </b> <span title="${target.route}">${target.addr.substring(0,32)}... </span>
                        <br>
                    `;
                }                    
                if(target.orderId){
                    targetsHtml+=`
                        <b>Order ID:</b> ${target.orderId}
                        <br>
                    `;
                }
                if(target.depositAddress){
                    targetsHtml+=`                  
                        <b>Receiving Address:</b> <a target="blank" href="${target.depositAddressExplorer}" title="${target.depositAddress}">${target.depositAddress}</a>
                        <br>
                    `;
                }
                targetsHtml+=`
                        <b>Sats: </b> ${target.sats}
                        <br>
                        <b>Invoice: </b> <i class="invoice">${target.invoice?target.invoice.invoice.substring(0, 32):""}...</i>
                        <br>
                        <b>Status: </b> <span class="status"></span>
                        <br>
                        <b>Expiry: </b> <span class="expiry"></span>
                        <br>`;
                if(target.notice){
                    targetsHtml+=`
                        <span class="warn">
                            ${target.notice}                
                        </span>
                    `;
                }

                targetsHtml+=`        
                    </td>
                </tr>
                `;


                targetEl = invoiceListEl.appendChild(Utils.html(targetsHtml,"tbody") );

         
            }
            const expiryEl = targetEl.querySelector(".expiry");
            const timeTillExpiration = target.invoice?target.invoice.expiry*1000 - ((Date.now() - target.invoice.timestamp*1000) ):0;
            const status = targetEl.querySelector(".status");

            if(target.scoinrouted){
                if(typeof routingComplete=="undefined")routingComplete=false;
                const routeStatus = await OpencollectiveRouter.getRouteStatus(target);
                if(routeStatus.code == 1){
                    target.status.code=1;
                    target.status.desc=routeStatus.desc;                    
                }else if(target.status.code == 0 && routeStatus.code == 2 ){
                    target.status.code = 2;
                    target.status.desc=routeStatus.desc;                   
                }else{
                    routingComplete=true;
                }
            }
            
            if (target.status.code == 1) {
                status.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${target.status.desc}`;
                expiryEl.innerText = timeTillExpiration < 0 ? "EXPIRED" : Utils.secondsToHms(timeTillExpiration/1000);

            }else if(timeTillExpiration < 0&&!payData.funded){
                status.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Expired`;
                expiryEl.innerText =  "EXPIRED";
            }else{
                payData.failed=false;
                if (!payData.funded) {
                    status.innerHTML = `<i class="fa fa-cog  fa-spin"></i> Waiting for funds...`;
                } else {
                    if (target.status.code == 2) {
                        status.innerHTML = `<i class="fa fa-cog  fa-spin"></i> Processing...`;
                    } else if (target.status.code == 0) {
                        status.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
                        expiryEl.innerText = "Complete";
                    }
                }
            }


        }


        const statusEl=this.stageEl.querySelector("#status");
        if(payData.complete&&(typeof routingComplete==="undefined"||routingComplete)){
            statusEl.innerHTML=`<i class="fa-solid fa-circle-check"></i> Donation completed.`
        }else if(payData.failed){
            statusEl.innerHTML=`<i class="fa-solid fa-circle-xmark"></i> Donation failed or partially completed.`
        }else if(payData.funded){
            statusEl.innerHTML=`<i class="fa fa-cog  fa-spin"></i> Processing donation...`
        }else {
            statusEl.innerHTML=`<i class="fa fa-cog  fa-spin"></i> Waiting for funds...`
        }
        // }



    }


}