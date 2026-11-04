import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/lib/i18n';
import { setLanguage } from '@/lib/i18n';
import { StatusPill } from '@/components/status-pill';
import { CategoryBadge } from '@/components/category-badge';
import { ConflictBadge } from '@/components/conflict-badge';
import { EmptyState } from '@/components/empty-state';
import { HoursBar } from '@/components/hours-bar';
import { Inbox } from 'lucide-react';

describe('domain components', () => {
  it('StatusPill shows the translated status and carries the status token', async () => {
    await setLanguage('en');
    const { rerender } = render(<StatusPill status="en_route" />);
    const pill = screen.getByText('En route');
    expect(pill.getAttribute('style')).toContain('--tone: var(--status-en-route)');

    await setLanguage('ar');
    rerender(<StatusPill status="en_route" />);
    expect(screen.getByText('في الطريق')).toBeInTheDocument();
    await setLanguage('en');
  });

  it('CategoryBadge pairs colour with an icon and label (never colour alone)', () => {
    render(<CategoryBadge category="document_delivery" />);
    const badge = screen.getByText('Document delivery');
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('ConflictBadge shows the worst severity and hides when there are none', () => {
    const { container, rerender } = render(<ConflictBadge conflicts={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ConflictBadge conflicts={[{ severity: 'info' }, { severity: 'blocking' }]} />);
    expect(screen.getByText('2 conflicts').className).toContain('text-danger');
  });

  it('EmptyState renders title, body and action', () => {
    render(<EmptyState icon={Inbox} title="Nothing here" body="Try again later" action={<button type="button">Do it</button>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Do it' })).toBeInTheDocument();
  });

  it('HoursBar reports overtime past the cap', () => {
    render(<HoursBar drivingMin={340} capMin={300} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '340');
    expect(screen.getByText('+0.7 h over')).toBeInTheDocument();
  });
});
