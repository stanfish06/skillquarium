// Reference solution for `selftest`; baseline shape, not skill-styled.
using System.Globalization;

public static class OrderParser
{
    public static OrderParseResult Parse(string input)
    {
        var orders = new List<Order>();
        var lines = input.Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (line.Length == 0) continue;
            int lineNo = i + 1;
            var parts = line.Split(';');
            if (parts.Length != 3) return OrderParseResult.Fail(lineNo, "expected 3 fields");
            var id = parts[0].Trim();
            if (id.Length == 0) return OrderParseResult.Fail(lineNo, "empty id");
            if (!int.TryParse(parts[1].Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var qty) || qty <= 0)
                return OrderParseResult.Fail(lineNo, "quantity must be a positive integer");
            if (!decimal.TryParse(parts[2].Trim(), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var price))
                return OrderParseResult.Fail(lineNo, "unit price must be a non-negative decimal");
            orders.Add(new Order(id, qty, price));
        }
        return OrderParseResult.Ok(orders);
    }
}

public sealed class Order
{
    public string Id { get; }
    public int Quantity { get; }
    public decimal UnitPrice { get; }
    public decimal Total => Quantity * UnitPrice;

    public Order(string id, int quantity, decimal unitPrice)
    {
        Id = id;
        Quantity = quantity;
        UnitPrice = unitPrice;
    }
}

public sealed class OrderParseResult
{
    public bool IsSuccess { get; }
    public IReadOnlyList<Order> Orders { get; }
    public string? Error { get; }
    public int ErrorLine { get; }

    private OrderParseResult(bool isSuccess, IReadOnlyList<Order> orders, string? error, int errorLine)
    {
        IsSuccess = isSuccess;
        Orders = orders;
        Error = error;
        ErrorLine = errorLine;
    }

    public static OrderParseResult Ok(IReadOnlyList<Order> orders) => new(true, orders, null, 0);
    public static OrderParseResult Fail(int line, string error) => new(false, Array.Empty<Order>(), error, line);
}
