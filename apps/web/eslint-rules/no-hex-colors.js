/**
 * CLAUDE.md — "Colours only via tokens/Tailwind theme (no hex in components)."
 *
 * A hex literal in a component bypasses dark mode: tokens.css re-points every
 * colour under [data-theme="dark"], a baked-in hex does not follow.
 */
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/;

/** @type {import('eslint').Rule.RuleModule} */
export const noHexColors = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hex colour literals in components; use design tokens.' },
    schema: [],
    messages: {
      hex: 'Hex colour "{{value}}" — use a design token (var(--…)) or the Tailwind theme instead, so dark mode follows (docs/DESIGN.md §2.1).',
    },
  },

  create(context) {
    function check(node, raw) {
      const match = HEX.exec(raw);
      if (match) context.report({ node, messageId: 'hex', data: { value: match[0] } });
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};
