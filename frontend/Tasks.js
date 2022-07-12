

export default class Tasks {
    static init() {
        const r = () => {
            this.renderTasks();
            setTimeout(r, 2000);
        }
        r();

    }

   

    static ok(id, text,clear) {

        const waitingTasks = this.getTasks();

        let oldTask = waitingTasks[id];
        if (!oldTask && text) {
            waitingTasks[id] = oldTask = {
                text: text
            };
        }
        if (oldTask) {
            console.log("Complete waiting task " + id);
            oldTask.done = true;
            oldTask.clear=clear;
            this.setTasks(waitingTasks)
            this.renderTasks();
        }
    }

    static setTasks(tasks) {
        const temp = {};
        for (let k in tasks) {
            const task = tasks[k];
            temp[k] = task;
        }
        this.temporaryTasks = temp;

    }



    static getTasks() {
        const tasks = this.temporaryTasks || {};
       
        return tasks;
    }


    static renderTasks() {
        const tasks = this.getTasks();


        let tasksListEl = document.querySelector("#tasks");
        if (!tasksListEl) {
            tasksListEl = document.createElement("ul");
            tasksListEl.setAttribute("id", "tasks");
            document.body.appendChild(tasksListEl);
        }



        for (let id in tasks) {
            const task = tasks[id];

            let taskEl = tasksListEl.querySelector("#task" + id);
            if (!taskEl) {
                taskEl = document.createElement("li");
                taskEl.setAttribute("id", "task" + id);
                tasksListEl.appendChild(taskEl);
            }

            if (task.done || task.error) {
                delete tasks[id];

                if (!task.clear) {
                    setTimeout(() => {
                        console.log("Completed", taskEl);
                        taskEl.remove();
                    }, task.buttons ? 1 : task.important ? 10000 : 4000);
                } else {
                    taskEl.remove();

                }
            }

            if (task.timeout && task.timeout < Date.now()) {
                task.done = true;
            }


            

         
            taskEl.innerHTML="";
            if(!task.buttons){
                if (task.done) {
                    taskEl.classList.add("completedTask");
                    taskEl.innerHTML = `<i class="fas fa-check-circle"></i>`;
                } else if (task.error) {
                    taskEl.classList.add("completedTask");
                    taskEl.innerHTML = `<i class="far fa-times-circle"></i>`;
                } else {
                    taskEl.innerHTML = `<i class="fas fa-spinner fa-pulse"></i>`;
                }
                if(typeof task.text=="string") taskEl.innerHTML += ` ${task.text}`;     
                else taskEl.appendChild(task.text);
            }else{
                taskEl.classList.add("confirmable")
                if(typeof task.text=="string") taskEl.innerHTML += ` ${task.text}`;     
                else taskEl.appendChild(task.text);
                const buttonCntEl=taskEl.appendChild(document.createElement("div"));  
                buttonCntEl.classList.add("buttons");
                for(const button of task.buttons){
                    const [name,callback] = Object.entries(button)[0];
                    const buttonEl=document.createElement("button");
                    buttonEl.innerHTML=name;
                    buttonEl.addEventListener("click",callback);
                    buttonCntEl.appendChild(buttonEl);

                }

            }
            
            
            taskEl.classList.remove("important");
            if(task.important||task.error){
                taskEl.classList.add("important");
            }
        }
        this.setTasks(tasks);
    }

    static error(id, text, important) {
        const waitingTasks = this.getTasks();

        let oldTask = waitingTasks[id];
        if (!oldTask && text) {
            waitingTasks[id] = oldTask = {
                text: text,
                important: important
            };
        }
        if (oldTask) {
            console.log("Complete waiting task " + id);
            oldTask.error = true;
            if(text)oldTask.text=text;
            this.setTasks(waitingTasks)
            this.renderTasks();
        }
    }

    static completable(id, text, timeout,buttons) {
        const waitingTasks = this.getTasks();
        waitingTasks[id] = {
            text: text,
            timeout: timeout ? (Date.now() + timeout) : undefined,
            done: false,
            buttons:buttons
        };    
        this.setTasks(waitingTasks)
        this.renderTasks();
    }
}