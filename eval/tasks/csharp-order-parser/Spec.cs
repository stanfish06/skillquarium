public static class Spec
{
    private static void Check(bool ok, string what)
    {
        if (!ok) throw new Exception("CHECK failed: " + what);
    }

    public static void Run()
    {
        var ok = OrderParser.Parse("a1;2;3.50\n\n b2 ; 1 ; 0.25 \r\n");
        Check(ok.IsSuccess, "IsSuccess");
        Check(ok.Error == null && ok.ErrorLine == 0, "no error on success");
        Check(ok.Orders.Count == 2, "two orders");
        Check(ok.Orders[0].Id == "a1" && ok.Orders[0].Quantity == 2 && ok.Orders[0].UnitPrice == 3.50m, "order 0 fields");
        Check(ok.Orders[0].Total == 7.00m, "order 0 total");
        Check(ok.Orders[1].Id == "b2" && ok.Orders[1].Quantity == 1 && ok.Orders[1].Total == 0.25m, "order 1 trimmed");

        var empty = OrderParser.Parse("");
        Check(empty.IsSuccess && empty.Orders.Count == 0, "empty input");
        var blanks = OrderParser.Parse("\n\n");
        Check(blanks.IsSuccess && blanks.Orders.Count == 0, "blank lines only");

        var bad = OrderParser.Parse("a1;2;3.50\n\nx;0;1.00\ny;1;1.00\n");
        Check(!bad.IsSuccess, "quantity 0 fails");
        Check(bad.ErrorLine == 3, "error line counts blanks: " + bad.ErrorLine);
        Check(bad.Error != null && bad.Orders.Count == 0, "failure has message and no orders");

        Check(OrderParser.Parse("a;1;1,50").ErrorLine == 1, "comma decimal separator rejected");
        Check(OrderParser.Parse("a;1;-1").ErrorLine == 1, "negative price rejected");
        Check(OrderParser.Parse(";1;1").ErrorLine == 1, "empty id rejected");
        Check(OrderParser.Parse("a;1").ErrorLine == 1, "two fields rejected");
        Check(OrderParser.Parse("a;1;1;1").ErrorLine == 1, "four fields rejected");
        Check(OrderParser.Parse("a;x;1").ErrorLine == 1, "non-integer quantity rejected");
        Check(OrderParser.Parse("a;1.5;1").ErrorLine == 1, "fractional quantity rejected");
        Check(OrderParser.Parse("a;1;abc").ErrorLine == 1, "non-numeric price rejected");
        Check(OrderParser.Parse("a;3;0").IsSuccess, "zero price allowed");
    }
}
