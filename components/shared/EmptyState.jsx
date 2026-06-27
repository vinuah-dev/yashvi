export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="bg-white rounded-xl p-8 shadow-sm text-center">
      {Icon && <Icon className="w-12 h-12 text-gray-300 mx-auto mb-3" />}
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-gray-500 text-sm mb-4">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
