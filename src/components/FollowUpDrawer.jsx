import FollowUpModal from './FollowUpModal';

// Kept for callers that explicitly request handset presentation. The reading
// mounts FollowUpModal once and changes its isHandset prop across breakpoints.
export default function FollowUpDrawer(props) {
  return <FollowUpModal {...props} isHandset />;
}
