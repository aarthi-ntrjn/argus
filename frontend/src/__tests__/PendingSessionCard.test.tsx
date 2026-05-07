import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PendingSessionCard from '../components/PendingSessionCard/PendingSessionCard';

describe('PendingSessionCard', () => {
  it('renders a spinner', () => {
    render(<PendingSessionCard tool="claude" repoPath="/repo/myproject" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the tool name for claude', () => {
    render(<PendingSessionCard tool="claude" repoPath="/repo/myproject" />);
    expect(screen.getByText(/claude/i)).toBeInTheDocument();
  });

  it('shows the tool name for copilot', () => {
    render(<PendingSessionCard tool="copilot" repoPath="/repo/myproject" />);
    expect(screen.getByText(/copilot/i)).toBeInTheDocument();
  });

  it('has an accessible label indicating pending state', () => {
    render(<PendingSessionCard tool="claude" repoPath="/repo/myproject" />);
    expect(screen.getByLabelText(/launching/i)).toBeInTheDocument();
  });
});
