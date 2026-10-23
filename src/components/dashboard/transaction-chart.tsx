import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface VoucherType {
  voucher_type_name: string;
  total_transaction_count: number;
  user_transaction_count: number;
  is_batch: boolean;
  is_bardan: boolean;
  in_source: boolean;
  in_destination: boolean;
  source_alias: string;
  destination_alias: string;
}

interface VoucherSummary {
  voucher_types: VoucherType[];
  total_voucher_types: number;
  total_organization_transactions: number;
  total_user_transactions: number;
}

interface TransactionChartProps {
  data?: VoucherSummary;
}

export default function TransactionChart({ data }: TransactionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    const loadChart = async () => {
      if (!canvasRef.current || !data || !data.voucher_types) return;

      // Dynamic import of Chart.js
      const { Chart, CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend } = await import('chart.js');
      
      Chart.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend);

      // Destroy existing chart if it exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      // Generate colors for each voucher type
      const colors = [
        'rgba(147, 51, 234, 0.8)', // Purple
        'rgba(99, 102, 241, 0.8)', // Indigo
        'rgba(20, 184, 166, 0.8)', // Teal
        'rgba(249, 115, 22, 0.8)', // Orange
        'rgba(34, 197, 94, 0.8)', // Green
        'rgba(59, 130, 246, 0.8)', // Blue
      ];

      const borderColors = [
        'rgba(147, 51, 234, 1)',
        'rgba(99, 102, 241, 1)',
        'rgba(20, 184, 166, 1)',
        'rgba(249, 115, 22, 1)',
        'rgba(34, 197, 94, 1)',
        'rgba(59, 130, 246, 1)',
      ];

      chartRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.voucher_types.map(vt => vt.voucher_type_name),
          datasets: [{
            label: 'Total Transactions',
            data: data.voucher_types.map(vt => vt.total_transaction_count),
            backgroundColor: colors.slice(0, data.voucher_types.length),
            borderColor: borderColors.slice(0, data.voucher_types.length),
            borderWidth: 2,
            borderRadius: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    };

    loadChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data]);

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Overview</h3>
        <div className="h-64">
          {!data || !data.voucher_types ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading chart data...</div>
            </div>
          ) : (
            <canvas ref={canvasRef} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
