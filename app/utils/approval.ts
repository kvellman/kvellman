// Review/approval state → UI label, badge colour, and icon (M4-B).
// Only 'approved' versions are delivered to winget clients.
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalMeta {
  label: string
  color: 'neutral' | 'success' | 'error' | 'warning'
  icon: string
}

export function approvalMeta(status: string): ApprovalMeta {
  switch (status) {
    case 'approved':
      return { label: 'Approved', color: 'success', icon: 'i-lucide-circle-check' }
    case 'rejected':
      return { label: 'Rejected', color: 'error', icon: 'i-lucide-circle-x' }
    default:
      return { label: 'Pending review', color: 'warning', icon: 'i-lucide-clock' }
  }
}
