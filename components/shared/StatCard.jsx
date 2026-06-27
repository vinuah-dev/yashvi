import Card from "./Card";

export default function StatCard({ title, value, change, icon }) {
  const isPositive = change?.startsWith("+");

  return (
    <Card padding="md" className="h-full">
      <div className="flex justify-between items-start mb-2">
        <span className="text-2xl">{icon}</span>
        {change && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${isPositive
                ? "bg-orange-100 text-[#f0813d]"
                : "bg-orange-100 text-[#f0813d]"
              }`}
          >
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </Card>
  );
}
