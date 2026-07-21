import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createPeopleImportExecutor } from "@/lib/people-import-execution";
import { closePeopleImportExecutionPool, peopleImportExecutionStore } from "@/lib/people-import-execution-data";

const executor=createPeopleImportExecutor(peopleImportExecutionStore),workerId=`execution-${randomUUID()}`;
try{while(await executor.runNext(workerId)){/* drain durable queue */}}finally{await closePeopleImportExecutionPool()}
