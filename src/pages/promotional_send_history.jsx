import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, History, Loader2, RefreshCw } from 'lucide-react'
import Loader from '@/components/common/Loader'
import AppPageShell from '@/components/layout/AppPageShell'
import PageHeader from '@/components/layout/PageHeader'
import {
  fetchPromotionalCampaign,
  fetchPromotionalCampaigns,
} from '@/lib/promotional_api'

const filterInputClass =
  'w-full h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
]

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function statusClass(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'sent' || value === 'completed') {
    return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  }
  if (value === 'partial' || value === 'skipped') {
    return 'text-amber-700 bg-amber-50 border-amber-200'
  }
  if (value === 'failed') {
    return 'text-red-700 bg-red-50 border-red-200'
  }
  return 'text-slate-700 bg-slate-50 border-slate-200'
}

function CampaignDetail({ campaignId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['promotional-campaign', campaignId],
    queryFn: () => fetchPromotionalCampaign(campaignId),
    enabled: Boolean(campaignId),
  })

  if (isLoading) {
    return (
      <div className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading recipients…
      </div>
    )
  }

  if (error) {
    return <div className="px-4 py-3 text-sm text-red-600">{error.message}</div>
  }

  const results = Array.isArray(data?.results) ? data.results : []
  if (!results.length) {
    return <div className="px-4 py-3 text-sm text-slate-500">No recipient rows saved.</div>
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/70">
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-2 px-4 py-2 text-[11px] font-medium text-slate-500">
        <span>Name</span>
        <span>To</span>
        <span>Status</span>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 bg-white">
        {results.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-2 items-start px-4 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">{row.name || '—'}</p>
              {row.message ? (
                <p className="text-[11px] text-slate-500 truncate" title={row.message}>
                  {row.message}
                </p>
              ) : null}
            </div>
            <p className="text-slate-700 truncate" title={row.to}>
              {row.to || '—'}
            </p>
            <span
              className={`inline-flex h-fit px-2 py-0.5 rounded-md border text-[11px] font-medium capitalize ${statusClass(row.status)}`}
            >
              {row.status || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PromotionalSendHistory() {
  const [channel, setChannel] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const queryParams = useMemo(
    () => ({
      channel: channel || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit: 100,
    }),
    [channel, dateFrom, dateTo],
  )

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['promotional-campaigns', queryParams],
    queryFn: () => fetchPromotionalCampaigns(queryParams),
    staleTime: 30_000,
  })

  const campaigns = data?.campaigns || []
  const summary = data?.summary || {
    total: campaigns.reduce((sum, row) => sum + Number(row.total || 0), 0),
    sent: campaigns.reduce((sum, row) => sum + Number(row.sent || 0), 0),
    failed: campaigns.reduce((sum, row) => sum + Number(row.failed || 0), 0),
    skipped: campaigns.reduce((sum, row) => sum + Number(row.skipped || 0), 0),
  }

  return (
    <AppPageShell>
    <div className="flex flex-col min-h-0 flex-1">
      {(isLoading || isFetching) && <Loader />}

      <PageHeader title="Send History">
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </PageHeader>

      <main className="flex-1 p-4 sm:p-6 space-y-4 pb-8">
        <p className="text-sm text-slate-500 -mt-1">
          Saved WhatsApp, Email, and SMS sends for your organization. Org admins see all org
          campaigns; other users see their own and their team&apos;s.
        </p>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                className={filterInputClass}
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className={filterInputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className={filterInputClass}
              />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] text-slate-500">Recipients</p>
            <p className="text-lg font-semibold text-slate-900">{summary.total ?? 0}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700">Success</p>
            <p className="text-lg font-semibold text-emerald-800">{summary.sent ?? 0}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[11px] text-red-700">Failed</p>
            <p className="text-lg font-semibold text-red-800">{summary.failed ?? 0}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700">Skipped</p>
            <p className="text-lg font-semibold text-amber-800">{summary.skipped ?? 0}</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-red-700 mb-4">{error.message}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-800 text-white text-sm hover:bg-blue-900"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : !isLoading && campaigns.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <History className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600">No send history yet.</p>
            <p className="text-sm text-slate-500 mt-1">
              Campaigns appear here after WhatsApp, Email, or SMS sends.
            </p>
          </div>
        ) : (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="hidden sm:grid grid-cols-[auto_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1fr)_repeat(4,minmax(0,0.45fr))_auto] gap-2 px-4 py-2.5 text-[11px] font-medium text-slate-500 border-b border-slate-100 bg-slate-50">
              <span />
              <span>When</span>
              <span>Channel</span>
              <span>Template / Subject</span>
              <span>Total</span>
              <span>Sent</span>
              <span>Failed</span>
              <span>Skipped</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-slate-100">
              {campaigns.map((campaign) => {
                const isOpen = expandedId === campaign.id
                return (
                  <div key={campaign.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : campaign.id)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50/80"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1fr)_repeat(4,minmax(0,0.45fr))_auto] gap-2 items-center text-sm">
                        <span className="text-slate-400">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {formatDateTime(campaign.created_at)}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            By {campaign.created_by?.name || '—'}
                          </p>
                        </div>
                        <p className="capitalize text-slate-700">{campaign.channel || '—'}</p>
                        <p className="truncate text-slate-800" title={campaign.template_name || campaign.subject}>
                          {campaign.template_name || campaign.subject || campaign.mode || '—'}
                        </p>
                        <p className="text-slate-800">{campaign.total ?? 0}</p>
                        <p className="text-emerald-700">{campaign.sent ?? 0}</p>
                        <p className="text-red-700">{campaign.failed ?? 0}</p>
                        <p className="text-amber-700">{campaign.skipped ?? 0}</p>
                        <span
                          className={`inline-flex w-fit px-2 py-0.5 rounded-md border text-[11px] font-medium capitalize ${statusClass(campaign.status)}`}
                        >
                          {campaign.status || '—'}
                        </span>
                      </div>
                    </button>
                    {isOpen ? <CampaignDetail campaignId={campaign.id} /> : null}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
    </AppPageShell>
  )
}
