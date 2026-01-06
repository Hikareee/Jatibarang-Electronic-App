import ApprovedRoute from '../components/ApprovedRoute'

export function wrapWithApproval(component) {
  return <ApprovedRoute>{component}</ApprovedRoute>
}

