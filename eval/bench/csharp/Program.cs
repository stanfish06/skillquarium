// `spec` runs Spec.Run(); `bench` times Bench.Run(). .NET has no allocation count, so allocs/op is "-".
using System.Diagnostics;
using System.Globalization;

public static class Program
{
    public static int Main(string[] args)
    {
        if (args.Length == 0) { Console.Error.WriteLine("usage: spec|bench"); return 2; }
        try
        {
            switch (args[0])
            {
                case "spec":
                    Spec.Run();
                    Console.WriteLine("spec ok");
                    return 0;
                case "bench":
                    return RunBench();
                default:
                    Console.Error.WriteLine("usage: spec|bench");
                    return 2;
            }
        }
        catch (Exception e)
        {
            Console.Error.WriteLine(e.ToString());
            return 1;
        }
    }

    private static int RunBench()
    {
        Bench.Setup();
        long sink = Bench.Run(); // warm-up, also JITs the path

        // calibrate n to ~0.3 s
        long n = 1;
        for (;;)
        {
            var t = Stopwatch.StartNew();
            for (long i = 0; i < n; i++) sink ^= Bench.Run();
            if (t.Elapsed.TotalMilliseconds >= 300 || n >= (1L << 24)) break;
            n *= 2;
        }

        GC.Collect();
        GC.WaitForPendingFinalizers();
        long before = GC.GetAllocatedBytesForCurrentThread();
        var sw = Stopwatch.StartNew();
        for (long i = 0; i < n; i++) sink ^= Bench.Run();
        double ns = sw.Elapsed.TotalNanoseconds;
        long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
        GC.KeepAlive(sink);
        Console.WriteLine(FormattableString.Invariant(
            $"BENCH ns/op={ns / n:F3} B/op={(double)bytes / n:F3} allocs/op=-"));
        return 0;
    }
}
