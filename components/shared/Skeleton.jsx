/**
 * Skeleton Components for Loading States
 * Provides skeleton screens matching the app's UI structure
 */

// Base Skeleton component with shimmer animation
export function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded ${className}`}
      style={{
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite linear'
      }}
      {...props}
    />
  );
}

// Stat Card Skeleton (for dashboard/member stats)
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton className="h-3 w-12 mb-2" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="w-10 h-10 rounded-lg" />
      </div>
    </div>
  );
}

// Member/User Card Skeleton
export function MemberCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4">
        {/* Top section with avatar and basic info */}
        <div className="flex items-start gap-3 mb-3">
          <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="w-16 h-6 rounded-full" />
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 mb-3 pt-3 border-t border-gray-100">
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }) {
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="h-4 flex-1" 
            style={{ maxWidth: i === 0 ? '120px' : 'auto' }}
          />
        ))}
      </div>
    </div>
  );
}

// Data Table Skeleton
export function DataTableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="h-4" 
              style={{ width: i === 0 ? '120px' : '100px' }}
            />
          ))}
        </div>
      </div>
      
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

// Profile Card Skeleton
export function ProfileCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// List Item Skeleton (for activity/attendance lists)
export function ListItemSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>
    </div>
  );
}

// Chart Skeleton (for dashboard analytics)
export function ChartSkeleton({ height = "200px" }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="flex items-end gap-2" style={{ height }}>
        {[40, 60, 45, 70, 55, 80, 65].map((height, i) => (
          <Skeleton 
            key={i} 
            className="flex-1" 
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// Page Header Skeleton
export function PageHeaderSkeleton() {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
    </div>
  );
}

// Search Filter Skeleton
export function SearchFilterSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// Announcement Card Skeleton
export function AnnouncementCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-16 w-full mb-3" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// Full Page Skeleton Layouts
export function MembersPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <PageHeaderSkeleton />
      
      <main className="px-3 py-3 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Search and Filters */}
        <SearchFilterSkeleton />

        {/* Member Cards */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <MemberCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <PageHeaderSkeleton />
      
      <main className="px-4 py-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Charts Section */}
        <div className="grid gap-4">
          <ChartSkeleton height="180px" />
          <ChartSkeleton height="200px" />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export function AttendancePageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <PageHeaderSkeleton />
      
      <main className="px-4 py-4 space-y-4">
        {/* Date selector */}
        <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-200">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Attendance List */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function FinancePageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <PageHeaderSkeleton />
      
      <main className="px-4 py-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Chart */}
        <ChartSkeleton height="200px" />

        {/* Transactions Table */}
        <DataTableSkeleton rows={6} columns={4} />
      </main>
    </div>
  );
}

export function AnnouncementsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <PageHeaderSkeleton />
      
      <main className="px-4 py-4 space-y-4">
        <SearchFilterSkeleton />
        
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <AnnouncementCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

