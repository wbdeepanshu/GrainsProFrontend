import { useRef, useState } from 'react'
import { Download, History, Loader2, Upload } from 'lucide-react'
import MarginChangeLogsDialog from '@/components/margin/MarginChangeLogsDialog'

export default function MarginExcelToolbar({
  canUpdate = false,
  onDownloadTemplate,
  onUploadExcel,
  onFeedback,
  inputId,
  downloadLabel = 'Template',
  logsPageType = '',
  logsTitle = 'Change Logs',
  LogsDialogComponent = null,
  logsDialogProps = {},
}) {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)

  const notify = (message, type = 'success') => {
    onFeedback?.(message, type)
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const result = await onDownloadTemplate?.()
      if (result?.rowCount != null && result.rowCount > 0) {
        notify(`Template downloaded with ${result.rowCount} row(s).`)
      } else {
        notify('Template downloaded successfully.')
      }
    } catch (err) {
      notify(err.message || 'Failed to download template.', 'error')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase().split('.').pop()
    if (!['xlsx', 'xls'].includes(ext)) {
      notify('Please select a valid Excel file (.xlsx or .xls).', 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      notify('File size must be less than 10MB.', 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    try {
      await onUploadExcel?.(selectedFile)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      notify(err.message || 'Failed to upload Excel file.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const showLogs = Boolean(LogsDialogComponent) || Boolean(logsPageType)

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
      >
        {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {downloadLabel}
      </button>

      {canUpdate ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id={inputId}
            disabled={isUploading}
          />
          <label
            htmlFor={inputId}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer ${
              isUploading ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <Upload className="h-4 w-4" />
            {selectedFile ? selectedFile.name : 'Choose Excel'}
          </label>
          {selectedFile ? (
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-brand text-sm font-medium disabled:opacity-60"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Excel
            </button>
          ) : null}
        </>
      ) : null}

      {showLogs ? (
        <button
          type="button"
          onClick={() => setLogsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <History className="h-4 w-4" />
          Logs
        </button>
      ) : null}

      {LogsDialogComponent ? (
        <LogsDialogComponent
          open={logsOpen}
          onClose={() => setLogsOpen(false)}
          title={logsTitle}
          {...logsDialogProps}
        />
      ) : (
        <MarginChangeLogsDialog
          open={logsOpen}
          onClose={() => setLogsOpen(false)}
          pageType={logsPageType}
          title={logsTitle}
        />
      )}
    </>
  )
}
