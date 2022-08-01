import PaymentManager from "../PaymentManager.js";
import Utils from "../Utils.js";
import Ux from "../Ux.js";
import Tasks from "../Tasks.js";
export default class Stage0 {

    async close(){
        this.stage0El.remove();
    }

    async show(config,payData,cntEl){
        let toSatsFunction=(input)=>input; //sats to sats

        const intro=config.intro?config.intro:`
        Donate to this project and its contributor on the
        <br>
        Bitcoin Lightning ⚡ Network`;
        this.stage0El=cntEl.appendChild(Utils.html(`
            <div class="stage">
                <div id="welcome">
                    <p>
                        ${intro}                
                    </p>

                    <br />
                    <hr>
                    <div class="list hlist">
                        <h3 id="history" class="clickable">
                            <i class="fa-solid fa-clock-rotate-left"></i> History
                        </h3>
                        <h3 id="help" class="clickable">
                            <i class="fa-solid fa-circle-question"></i> Help          
                        </h3>
                    </div>
                    <hr>
                </div>            
            </div>
        `));

        this.stage0El.querySelector("#help").addEventListener("click",()=>{

            Tasks.completable("homePopup",Utils.html(`
            <div class="list vlist">
            <div class="list hlist">
            <img src="logo.png" style="width:8rem;height:8rem"/>

                <p class="intro" style="text-align:left">Donations are made throught the 
                    Bitcoin Lightning ⚡ network. <br />
                    To send the payment you will need a Bitcoin Lightning compatible wallet
                    such as            
                </p>
                </div>
                <div class="wallets sub">
                    <div><a href="https://getalby.com/" target="_blank"><i class="fas fa-check"></i> Alby: Browser extension </a></div>
                    <div><a href="https://strike.me"><i class="fas fa-check"></i> Strike.me <i title="Available on Android" class="fab fa-android"></i> <i title="Available on iOS"  class="fab fa-apple"></i> <i title="Available on Chrome" class="fab fa-chrome"></i><i>: USD on/offramp</i> </a></div>
                    <div><a href="https://muun.com/" target="_blank"><i class="fas fa-check"></i></i> Muun <i title="Available on Android" class="fab fa-android"></i> <i title="Available on iOS"  class="fab fa-apple"></i></a></div>
                    <div><a href="https://phoenix.acinq.co/" target="_blank"><i class="fas fa-check"></i> Phoenix  <i title="Available on Android" class="fab fa-android"></i> <i title="Available on iOS"  class="fab fa-apple"></i></a></div>
                    <div><a href="https://bluewallet.io/" target="_blank"><i class="fas fa-check"></i> BlueWallet  <i title="Available on Android" class="fab fa-android"></i> <i title="Available on iOS"  class="fab fa-apple"></i> - <i title="Available on MacOS"  class="fab fa-apple"></i> </a></div>
                    <div><a href="https://www.walletofsatoshi.com/" target="_blank"><i class="fas fa-check"></i> Wallet of Satoshi  <i title="Available on Android" class="fab fa-android"></i> <i title="Available on iOS"  class="fab fa-apple"></i></a></div>
                    <div><a href="https://zaphq.io/" target="_blank"><i class="fas fa-check"></i> Zap <i title="Available on Android" class="fab fa-android"></i> <i title="Available on iOS"  class="fab fa-apple"></i> - <i  title="Available on Windows" class="fab fa-microsoft"></i> <i  title="Available on Linux" class="fab fa-linux"></i> <i title="Available on MacOS"  class="fab fa-apple"></i>  </a></div>
                </div>
            </div>
            `),undefined,[
                {'<i class="fa-solid fa-x"></i> Close' :()=>{
                    Tasks.ok("homePopup");  
                }}
            ]);
        });

        // latest donations
      
        this.stage0El.querySelector("#history").addEventListener("click",async ()=>{

            const latestDonationsEl=Utils.html(`
                <div id="latestDonations">
                    <h3>Your latest donations</h3>
                    <span id="localInvoices" class="warn"></span>
                </div>
            `);
            const localInvoicesEl=latestDonationsEl.querySelector("#localInvoices");

            try{
                const latestInvoices=await Ux.getPayDataBackups();
                let first=true;
                for(const li of latestInvoices){
                    if(!li.invoice)continue;
                    const invEl=localInvoicesEl.appendChild(Utils.html(`<a class="clickable" ></a>`));

                    invEl.addEventListener("click",async el=>{
                        await Ux.setPayData(li);
                        await Ux.showStage(3,config,li);
                    });
                    invEl.innerText=(first?"":", ")+li.invoice.substring(0,16)+"...";
                    first=false;
                }
                
            }catch(e){
                console.error(e);
            }

            Tasks.completable("homePopup",latestDonationsEl,undefined,[
                {'<i class="fa-solid fa-upload"></i> Upload an Invoice':
                    async ()=>{
                        const fakeInput=Utils.html(`
                            <input type="file" accept="application/json" style="display:none">
                        `);         
                        document.body.appendChild(fakeInput);
                        fakeInput.addEventListener("change",async ()=>{
                            const reader = new FileReader();
                            reader.onload = res=> {
                                payData = res.target.result;
                                payData=JSON.parse(payData);
                                fakeInput.remove();
                                Ux.setPayData(payData);
            
                                Ux.showStage(3,config,payData);
                            };
                            payData=reader.readAsText(fakeInput.files[0]);
                        });
                        fakeInput.click();
            
            
                    }
                },
                {'<i class="fa-solid fa-x"></i> Close':()=>{
                    Tasks.ok("homePopup","",true);
                }}
                
            ]);
        });



        const inputValueContainerEl=this.stage0El.appendChild(Utils.html(`
            <div id="inputValue">
                    <h3><i class="fa-solid fa-hand-holding-dollar"></i> New Donation</h3>
                    <span class="warn conversionMsg"></span>            
                <div class="currencySelector">
                    <input type="number" min="0" >
                </div>
            </div>
        `));
      
        const inputValueEl=inputValueContainerEl.querySelector(".currencySelector input[type=number]");
        inputValueEl.value=payData.sats;
        inputValueEl.addEventListener("input",async ()=>{
            const min=inputValueEl.getAttribute("min");
            if(inputValueEl.value<new Number(min)){
                inputValueEl.setCustomValidity("Minimum value: "+min);
                inputValueEl.reportValidity();
            }else{
                payData.sats=await toSatsFunction(new Number(inputValueEl.value));
                inputValueEl.setCustomValidity('');
                inputValueEl.reportValidity();
            }
        });
        
        inputValueEl.addEventListener("click",async ()=>{
            inputValueEl.focus();
            inputValueEl.select();
        });


        const _setWarn=(msg)=>{
            inputValueContainerEl.querySelector(".warn.conversionMsg").innerText=msg;
        };

        const _createCurrencyButton=(text,title,step,decimals,convertToSats,convertFromSats,onClick,selected)=>{
            const currencySelectorEl=inputValueContainerEl.querySelector(".currencySelector");

            const btnEl=currencySelectorEl.appendChild(Utils.html(`
                <button title="${title}" class="currency${text} currencyBtn">${text}</button>
            `));
             
            const f=async ()=>{
                _setWarn("");
                payData.preferredCurrency=text;
                const v=(await convertFromSats(payData.sats)).toFixed(decimals)+"";
                inputValueEl.value=v;
                inputValueEl.setAttribute("step",step);
                inputValueEl.setAttribute("min",await convertFromSats(config.minimumAmountSats));

                toSatsFunction=convertToSats;
                if(onClick)onClick();
                currencySelectorEl.querySelectorAll(".currencyBtn").forEach(el=>el.classList.remove("selected"));
                currencySelectorEl.querySelectorAll(".currency"+text).forEach(el=>el.classList.add("selected"));
            }
            btnEl.addEventListener("click",f);
            if(selected)f();

        }

        _createCurrencyButton("BTC","View amount in Bitcoin",0.0001,6,(v)=>v*100000000,(v)=>v/100000000,()=>{},config.defaultCurrency=="BTC");
        _createCurrencyButton("SATS","View amount in Satoshis",1,0,(v)=>v,(v)=>v,()=>{},config.defaultCurrency=="SATS");
        _createCurrencyButton("USD","View amount in USD",0.01,2,async (v)=>{
            const priceData=await Utils.fetchBackend("prices/BTCUSD",{});
            _setWarn(priceData.message);
            if(priceData.value){
                const btc=v/priceData.value;
                return Math.floor(btc*100000000);
            }       
        },async (v)=>{
            const btc=v/100000000;
            const priceData=await Utils.fetchBackend("prices/BTCUSD",{});
            _setWarn(priceData.message);
            if(priceData.value){
                return Math.floor(btc*priceData.value*100)/100.;
            }            
        },()=>{},config.defaultCurrency=="USD");

        
        const feeReserveEl=inputValueContainerEl.appendChild(Utils.html(`
            <div class="warn">
                ${config.fee}% of the total amount is reserved to pay transaction fees.
                <br />
                You can decide to withdraw or donate the unspent fees to ⚡plit Donation:
                <br />
                <button id="toggleFeeDonation" ></button>

            </div>        
        `));


        const toggleUnspentFeesDonationEl=feeReserveEl.querySelector("button#toggleFeeDonation");
        const _updateToggle=()=>{
            if(payData.donateExtraFee){
                toggleUnspentFeesDonationEl.innerHTML=`<i class="fa-solid fa-circle-check"></i> Donate unspent fees`
            }else{
                toggleUnspentFeesDonationEl.innerHTML=`<i class="fa-solid fa-circle"></i> Donate unspent fees`
            }
        }

        toggleUnspentFeesDonationEl.addEventListener("click",()=>{
            payData.donateExtraFee=payData.donateExtraFee?"":config["devmode"]?"pay@alice-lnsplitpay.test":"rblb@getalby.com";
            _updateToggle();
        });
        _updateToggle();



    //     const inputValueEMAILMsgEl=inputValueContainerEl.appendChild(document.createElement("p"));
    //     inputValueEMAILMsgEl.innerText="Please input a valid email address. This will be used to process opencollective's donations";

    //   const inputEmail=inputValueContainerEl.appendChild(document.createElement("input"));
    //   inputEmail.setAttribute("type","text");
    //   inputEmail.addEventListener("input",async ()=>{
    //         payData.email=inputEmail.value;
    //     });

    
        const targetsContainerEl=this.stage0El.appendChild(Utils.html(`
            <div id="targets" >
            </div>
        `));
        const updateSliders = async (target) => {
            if(this.updatingSliders){
                setTimeout(()=>updateSliders(target),100);
                return;
            }
            this.updatingSliders=true;
            if(target){
                const sliderEl = targetsContainerEl.querySelector(`#${target.elementId}`);
                target.weight = Number.parseInt(sliderEl.value) / 100.;
            }
   
            await PaymentManager.resolveWeights(payData);
            for (const target2 of payData.targets) {
                const sliderEl = targetsContainerEl.querySelector(`#${target2.elementId}`);
                sliderEl.value = Math.floor(target2.weight * 100);
                targetsContainerEl.querySelector(`#${target2.elementId}-value`).innerText = `${sliderEl.value}%`;
    
            }   
            this.updatingSliders=false;
        };

        for (const target of payData.targets){
            target.elementId="Slider"+Utils.randomString();

            const targetEl=targetsContainerEl.appendChild(Utils.html(`
                <div class="payTarget">
                    <label>${target.description}</label>
                    <div>
                        <input type="range" min="0" max="100" value="${target.weight*100}" id="${target.elementId}">
                        <span id="${target.elementId}-value"></span>
                    </div>
                </div>
            `));
            targetEl.querySelector("#"+target.elementId).addEventListener("input",()=>{
                updateSliders(target);
            });
            
    

     
        }
        setTimeout(async ()=>{
            await updateSliders();
            setTimeout(()=>updateSliders(),10);
        },1000);
        

        inputValueEl.addEventListener("input",async ()=>{
            const min=inputValueEl.getAttribute("min");
            if(inputValueEl.value<new Number(min))return;
            if(this.timedUpdate)clearTimeout(this.timedUpdate);
            
            this.timedUpdate=setTimeout(()=>{              
                 updateSliders();
            },100);
        });

        const controlsEl=this.stage0El.appendChild(Utils.html(`
            <div class="controls">  
            <span class="warn">
                The following fields are optional, you can leave them empty.
                <br>
                Only the email is required when donating to an opencollective.
            
            </span>
  
            <table>
              
                    <tr>
                    <td>Your name:</td> <td><input type="text" id="name"></td>
                    </tr>
                    <tr>

                    <td>Your Email:</td> <td><input type="text" id="email"></td>
                    </tr>
                        <tr>
                        <td>Leave a message:</td> <td>  <textarea maxlength="100" id="message"></textarea></td>   
                    </tr>
                </table>
                
                <br>
                <br>

                <button id="continueBtn" class="bigButton">Continue <i class="fas fa-angle-right"></i></button>
            </div>
        
        `));

        controlsEl.querySelector("#email").addEventListener("change",(ev)=>{
            payData.email=ev.target.value?ev.target.value:undefined;
        });

        controlsEl.querySelector("#name").addEventListener("change",(ev)=>{
            payData.donorName=ev.target.value?ev.target.value:undefined;
        });

        controlsEl.querySelector("#message").addEventListener("change",(ev)=>{
            payData.message=ev.target.value?ev.target.value:undefined;
        });

        controlsEl.querySelector("#continueBtn").addEventListener("click",async ()=>{
            let donatingToOc=false;
            for(const target of payData.targets){
                if(target.type=="opencollective"&&target.weight>0){
                    donatingToOc=true;
                    break;
                }
            }
            if(!payData.email&&donatingToOc){
                return Tasks.error("email-requires",`Email required to donate to an OpenCollective`,true);
            }
            if(payData.sata<config.minimumAmountSats){
                return Tasks.error("input-invalid",`Input amount is less than minimum`, true);
            }
            try{
                Tasks.ok("email-requires","",true);
                Tasks.ok("input-invalid","",true);
                await Ux.showStage(1,config,payData);
            }catch(e){
                console.error(e);
                Tasks.error("stage-load",`Can't load stage 0`);

            }
        });
    }
}