import assert from "node:assert/strict";
import * as z from "zod";

const Command = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("add"),
		amount: z.number().int().positive(),
	}),
	z.strictObject({ kind: z.literal("remove"), id: z.string().min(1) }),
]);

let applied = 0;
function apply(input: unknown): boolean {
	const result = Command.safeParse(input);
	if (!result.success) return false;
	// Side effects receive only validated, narrowed data.
	if (result.data.kind === "add") applied += result.data.amount;
	return true;
}

assert.equal(apply({ kind: "add", amount: 3 }), true);
assert.equal(applied, 3);
assert.equal(apply({ kind: "add", amount: "3" }), false);
assert.equal(apply({ kind: "add", amount: 2, admin: true }), false);
assert.equal(apply({ kind: "remove", amount: 2 }), false);
assert.equal(applied, 3);
assert.equal(Command.safeParse({ kind: "remove", id: "item-1" }).success, true);

const Query = z.strictObject({
	limit: z
		.string()
		.regex(/^[1-9]\d*$/)
		.pipe(z.coerce.number<string>().int().max(100)),
	enabled: z.stringbool(),
});
const queryInput: z.input<typeof Query> = { limit: "12", enabled: "false" };
const queryOutput: z.output<typeof Query> = Query.parse(queryInput);
const limit: number = queryOutput.limit;
const enabled: boolean = queryOutput.enabled;
assert.deepEqual({ limit, enabled }, { limit: 12, enabled: false });
assert.equal(Query.safeParse({ limit: "", enabled: "false" }).success, false);
assert.equal(Query.safeParse({ limit: "101", enabled: "true" }).success, false);
assert.equal(
	Query.safeParse({ limit: "1", enabled: "perhaps" }).success,
	false,
);
assert.equal(z.coerce.boolean().parse("false"), true);

const AvailableName = z
	.string()
	.refine(async (name) => name !== "taken", { error: "Name is unavailable" });
assert.equal((await AvailableName.safeParseAsync("taken")).success, false);
assert.equal((await AvailableName.safeParseAsync("free")).success, true);

console.log(
	"Zod smoke passed: invalid commands blocked, query types parsed, async checks awaited.",
);
