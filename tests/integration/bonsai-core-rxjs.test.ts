import { describe, expect, it, jest } from "@jest/globals";
import { RXJS, Valibot } from "@bonsai/core";

describe("@bonsai/core integration — rxjs + valibot", () => {
  it("RXJS Subject emits values to subscribers", () => {
    const subject = new RXJS.Subject<string>();
    const callback = jest.fn();

    subject.subscribe((value) => {
      callback(value);
    });

    subject.next("Hello, Bonsai!");

    expect(callback).toHaveBeenCalledWith("Hello, Bonsai!");
  });

  it("Valibot schema parses valid data", () => {
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

    type SchemaType = Valibot.InferInput<typeof schema>;

    const payload: SchemaType = {
      name: "Alice",
      age: 30
    };

    const parsed = Valibot.parse(schema, payload);
    expect(parsed).toEqual(payload);
  });
});
