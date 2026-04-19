import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackDropdown from './FeedbackDropdown';

describe('FeedbackDropdown', () => {
  it('renders a "Feedback" trigger button', () => {
    render(<FeedbackDropdown />);
    expect(screen.getByRole('button', { name: /feedback/i })).toBeInTheDocument();
  });

  it('dropdown is closed by default', () => {
    render(<FeedbackDropdown />);
    expect(screen.queryByText(/report a bug/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/request a feature/i)).not.toBeInTheDocument();
  });

  it('opens dropdown when trigger button is clicked', async () => {
    render(<FeedbackDropdown />);
    await userEvent.click(screen.getByRole('button', { name: /feedback/i }));
    expect(screen.getByText(/report a bug/i)).toBeInTheDocument();
    expect(screen.getByText(/request a feature/i)).toBeInTheDocument();
  });

  it('closes dropdown when trigger button is clicked again', async () => {
    render(<FeedbackDropdown />);
    const btn = screen.getByRole('button', { name: /feedback/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByText(/report a bug/i)).not.toBeInTheDocument();
  });

  it('"Report a Bug" is an anchor with target="_blank" and rel="noopener noreferrer"', async () => {
    render(<FeedbackDropdown />);
    await userEvent.click(screen.getByRole('button', { name: /feedback/i }));
    const link = screen.getByRole('link', { name: /report a bug/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('"Report a Bug" href contains GitHub issues URL with bug label', async () => {
    render(<FeedbackDropdown />);
    await userEvent.click(screen.getByRole('button', { name: /feedback/i }));
    const link = screen.getByRole('link', { name: /report a bug/i });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('github.com/aarthi-ntrjn/argus/issues/new');
    expect(href).toContain('labels=bug');
  });

  it('"Request a Feature" is an anchor with target="_blank" and rel="noopener noreferrer"', async () => {
    render(<FeedbackDropdown />);
    await userEvent.click(screen.getByRole('button', { name: /feedback/i }));
    const link = screen.getByRole('link', { name: /request a feature/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('"Request a Feature" href contains GitHub issues URL with enhancement label', async () => {
    render(<FeedbackDropdown />);
    await userEvent.click(screen.getByRole('button', { name: /feedback/i }));
    const link = screen.getByRole('link', { name: /request a feature/i });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('github.com/aarthi-ntrjn/argus/issues/new');
    expect(href).toContain('labels=enhancement');
  });

  it('closes dropdown on Escape key', async () => {
    render(<FeedbackDropdown />);
    await userEvent.click(screen.getByRole('button', { name: /feedback/i }));
    expect(screen.getByText(/report a bug/i)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(/report a bug/i)).not.toBeInTheDocument();
  });
});
