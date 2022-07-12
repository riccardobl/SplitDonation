
import Ux from './Ux.js';
import Utils from './Utils.js';
import PaymentManager from './PaymentManager.js';
import Sane from '../common/Sane.js';

export default async function main(window){
    window.onhashchange = function() {
        window.location.lasthash.push(window.location.hash);
        window.location.hash = curr;
    };
       

    const config=await window.fetch("./config.json").then(r=>r.json());
    if(config.title)Ux.setTitle(config.title,config.titleHeader||config.title);
    

    await Sane.init(DOMPurify);
    await Utils.init(window,config);
    await Ux.init(window,config);
    await PaymentManager.init(config);

    window.onhashchange = function() {
        Ux.showStage();
    };
    Ux.showStage();

       
}
window.addEventListener("load",  ()=>{
    main(window);
});