const { Worker } = require("worker_threads");
const path = require("path");

class WorkerPool {

    constructor(size) {
        this.size = size;
        this.workers = [];
        this.queue = [];
        this.active = 0;

        for (let i = 0; i < size; i++)
            this.workers.push(
                new Worker(
                    path.join(__dirname, "worker.js")
                )
            );
    }

    run(job) {

        return new Promise((resolve) => {

            const execute = (worker) => {

                worker.once("message", (result) => {
                    this.active--;
                    resolve(result);
                    this.next();
                });

                worker.postMessage(job);
            };

            this.queue.push(execute);
            this.next();
        });
    }

    next() {

        if (
            this.queue.length === 0 ||
            this.active >= this.size
        ) return;

        const job = this.queue.shift();
        const worker =
            this.workers[this.active % this.size];

        this.active++;
        job(worker);
    }


    // just to close here -- not permanent
    close() {
        return Promise.all(
            this.workers.map(w => w.terminate())
        );
    }

}

module.exports = WorkerPool;
