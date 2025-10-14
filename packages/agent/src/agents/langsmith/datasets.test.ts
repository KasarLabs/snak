import * as ls from "langsmith/vitest";
import { Client } from "langsmith";

const client = new Client();
const examples = await client.listExamples({ datasetName: "my-dataset" });

ls.describe("Correctness with dataset", () => {
    for (const example of examples) {
        ls.test(example.id, {
            inputs: example.inputs,
            referenceOutputs: example.outputs
        }, async ({ inputs, referenceOutputs }) => {
            const outputs = await myLLMApp(inputs);
            ls.logOutputs({ answer: outputs });
            await correctnessEvaluator({
                inputs,
                outputs,
                referenceOutputs,
            });
        });
    }
});
