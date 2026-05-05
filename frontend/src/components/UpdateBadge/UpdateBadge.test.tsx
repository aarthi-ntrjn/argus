import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UpdateBadge } from './UpdateBadge';

describe('UpdateBadge', () => {
  it('renders a badge with accessible label when updateAvailable is true', () => {
    render(<UpdateBadge updateAvailable={true} latestVersion="2.0.0" />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Update available: v2.0.0');
    expect(badge).toHaveAttribute('title', 'Update available: v2.0.0');
  });

  it('includes the version text in the badge', () => {
    render(<UpdateBadge updateAvailable={true} latestVersion="3.1.4" />);
    expect(screen.getByText(/3\.1\.4/)).toBeInTheDocument();
  });

  it('renders nothing when updateAvailable is false', () => {
    const { container } = render(<UpdateBadge updateAvailable={false} latestVersion={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when updateAvailable is false even with a version', () => {
    const { container } = render(<UpdateBadge updateAvailable={false} latestVersion="2.0.0" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a badge without version text when latestVersion is null', () => {
    render(<UpdateBadge updateAvailable={true} latestVersion={null} />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
  });
});
