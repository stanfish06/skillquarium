using System.Globalization;
using System.Text;

public static class Bench
{
    private static string input = "";

    public static void Setup()
    {
        var sb = new StringBuilder();
        for (int i = 0; i < 5000; i++)
        {
            sb.Append("id").Append(i).Append(';')
              .Append(i % 9 + 1).Append(';')
              .Append(((i % 100) / 4.0m).ToString(CultureInfo.InvariantCulture))
              .Append('\n');
        }
        input = sb.ToString();
    }

    public static long Run()
    {
        var r = OrderParser.Parse(input);
        long acc = r.IsSuccess ? 1 : 0;
        foreach (var o in r.Orders) acc += o.Quantity;
        return acc;
    }
}
