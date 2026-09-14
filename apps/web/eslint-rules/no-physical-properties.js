/**
 * Custom rule referenced by docs/DESIGN.md §3 as `tailwindcss/no-physical-properties`.
 *
 * Arabic is a first-class layout, not a flipped afterthought: every spacing,
 * alignment and position utility must be logical so the same markup mirrors
 * correctly under dir="rtl".
 *
 * Checks className/class JSX attributes and the arguments of cn()/clsx()/cva().
 * Genuine exceptions (e.g. the calendar time axis, which stays LTR inside an
 * RTL page — docs/DESIGN.md §7) should use eslint-disable-next-line with a
 * comment explaining why.
 */

/** @type {[RegExp, string][]} */
const PHYSICAL = [
  [/(^|:)ml-/, 'ms-'],
  [/(^|:)mr-/, 'me-'],
  [/(^|:)pl-/, 'ps-'],
  [/(^|:)pr-/, 'pe-'],
  [/(^|:)-?left-/, 'start-'],
  [/(^|:)-?right-/, 'end-'],
  [/(^|:)text-left\b/, 'text-start'],
  [/(^|:)text-right\b/, 'text-end'],
  [/(^|:)border-l\b/, 'border-s'],
  [/(^|:)border-r\b/, 'border-e'],
  [/(^|:)rounded-l\b/, 'rounded-s'],
  [/(^|:)rounded-r\b/, 'rounded-e'],
  [/(^|:)rounded-tl\b/, 'rounded-ss'],
  [/(^|:)rounded-tr\b/, 'rounded-se'],
  [/(^|:)rounded-bl\b/, 'rounded-es'],
  [/(^|:)rounded-br\b/, 'rounded-ee'],
  [/(^|:)float-left\b/, 'float-start'],
  [/(^|:)float-right\b/, 'float-end'],
  [/(^|:)clear-left\b/, 'clear-start'],
  [/(^|:)clear-right\b/, 'clear-end'],
  [/(^|:)scroll-ml-/, 'scroll-ms-'],
  [/(^|:)scroll-mr-/, 'scroll-me-'],
  [/(^|:)scroll-pl-/, 'scroll-ps-'],
  [/(^|:)scroll-pr-/, 'scroll-pe-'],
  // Tailwind v3 has no logical transform-origin utility, so the fix here is
  // the direction variants rather than a drop-in replacement.
  [/(^|:)origin-left\b/, 'ltr:origin-left rtl:origin-right'],
  [/(^|:)origin-right\b/, 'ltr:origin-right rtl:origin-left'],
];

const CALL_NAMES = new Set(['cn', 'clsx', 'classNames', 'cva', 'twMerge']);

/** @type {import('eslint').Rule.RuleModule} */
export const noPhysicalProperties = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow physical Tailwind utilities (ml/mr/pl/pr/left/right/text-left…) so RTL mirrors correctly.',
    },
    schema: [],
    messages: {
      physical:
        '"{{token}}" is a physical utility and will not mirror in Arabic (RTL). Use "{{suggestion}}" instead. See docs/DESIGN.md §3.',
    },
  },

  create(context) {
    function checkValue(node, value) {
      for (const token of value.split(/\s+/)) {
        if (!token) continue;
        for (const [pattern, suggestion] of PHYSICAL) {
          if (pattern.test(token)) {
            context.report({ node, messageId: 'physical', data: { token, suggestion } });
            break;
          }
        }
      }
    }

    function checkNode(node) {
      if (!node) return;
      if (node.type === 'Literal' && typeof node.value === 'string') {
        checkValue(node, node.value);
      } else if (node.type === 'TemplateLiteral') {
        for (const quasi of node.quasis) checkValue(node, quasi.value.raw);
      } else if (node.type === 'ConditionalExpression') {
        checkNode(node.consequent);
        checkNode(node.alternate);
      } else if (node.type === 'LogicalExpression') {
        checkNode(node.right);
      } else if (node.type === 'ArrayExpression') {
        for (const element of node.elements) checkNode(element);
      } else if (node.type === 'ObjectExpression') {
        for (const property of node.properties) {
          if (property.type !== 'Property') continue;
          if (property.key.type === 'Literal') checkValue(property.key, String(property.key.value));
          checkNode(property.value);
        }
      } else if (node.type === 'JSXExpressionContainer') {
        checkNode(node.expression);
      } else if (node.type === 'CallExpression') {
        if (node.callee.type === 'Identifier' && CALL_NAMES.has(node.callee.name)) {
          for (const argument of node.arguments) checkNode(argument);
        }
      }
    }

    return {
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : '';
        if (name !== 'className' && name !== 'class') return;
        checkNode(node.value);
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || !CALL_NAMES.has(node.callee.name)) return;
        for (const argument of node.arguments) checkNode(argument);
      },
    };
  },
};

export default {
  rules: { 'no-physical-properties': noPhysicalProperties },
};
