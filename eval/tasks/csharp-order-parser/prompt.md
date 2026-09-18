Write a self-contained C# file `Solution.cs` for .NET 10 (no NuGet packages,
nullable reference types enabled) that parses order lines.

Each non-empty line of the input is `id;quantity;unitPrice`. Whitespace around
a field is trimmed. `id` is a non-empty token, `quantity` a positive integer,
`unitPrice` a non-negative decimal written with `.` as the separator
regardless of the machine's culture.

Expose exactly these public members. Whether each type is a class, record or
struct is up to you.

```csharp
public static class OrderParser
{
    public static OrderParseResult Parse(string input);
}

// OrderParseResult:
//   bool IsSuccess
//   IReadOnlyList<Order> Orders   -- empty when IsSuccess is false
//   string? Error                 -- null when IsSuccess is true
//   int ErrorLine                 -- 1-based line of the first invalid line, 0 on success

// Order:
//   string Id
//   int Quantity
//   decimal UnitPrice
//   decimal Total                 -- Quantity * UnitPrice
```

Behaviour:

1. The first invalid line stops parsing. Blank lines are skipped but still
   count toward line numbers.
2. Empty input is a success with zero orders.

Return only the contents of `Solution.cs` in a single C# code block.
