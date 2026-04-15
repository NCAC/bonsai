import { RXJS, Valibot, EventTrigger } from "@bonsai/core";

const subject = new RXJS.Subject<string>();

subject.subscribe((value) => {
  console.log("Received:", value);
});

subject.next("Hello, Bonsai!");

const schema = Valibot.object({
  name: Valibot.pipe(
    Valibot.string(),
    Valibot.minLength(3),
    Valibot.maxLength(255)
  ),
  age: Valibot.pipe(
    Valibot.number(),
    Valibot.minValue(0),
    Valibot.maxValue(150)
  )
});
// infer type of schema
type SchemaType = Valibot.InferInput<typeof schema>;

const testString: SchemaType = {
  name: "Alice",
  age: 30
};
