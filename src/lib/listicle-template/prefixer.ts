export interface PrefixOptions {
  templateName: string;
}

const ROOT_ELEMENTS = ['html', 'body', ':root'];

function isRootElement(selector: string): boolean {
  const trimmed = selector.trim().toLowerCase();
  return ROOT_ELEMENTS.some(el => trimmed === el || trimmed.startsWith(el + ':'));
}

function prefixSelector(selector: string, templateName: string): string {
  const trimmed = selector.trim();
  
  if (!trimmed) return trimmed;
  
  if (trimmed.startsWith('@') || trimmed.startsWith('//')) {
    return trimmed;
  }
  
  if (isRootElement(trimmed)) {
    return trimmed;
  }
  
  const classPrefix = templateName.startsWith('.') ? templateName : `.${templateName}`;
  
  if (trimmed.startsWith('(') || trimmed.includes(':not(') || trimmed.includes(':is(') || trimmed.includes(':where(')) {
    return `${classPrefix} ${trimmed}`;
  }
  
  return `${classPrefix} ${trimmed}`;
}

function splitRules(css: string): string[] {
  const result: string[] = [];
  let current = '';
  let braceDepth = 0;
  
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    
    if (char === '{') {
      braceDepth++;
      current += char;
    } else if (char === '}') {
      braceDepth--;
      current += char;
      if (braceDepth === 0 && current.trim()) {
        result.push(current.trim());
        current = '';
      }
    } else if (braceDepth === 0 && char === '\n' && css[i+1] === '\n') {
      if (current.trim()) {
        result.push(current.trim());
      }
      current = '';
      i++;
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    result.push(current.trim());
  }
  
  return result;
}

function prefixMediaQuery(mediaQuery: string, templateName: string): string {
  const classPrefix = templateName.startsWith('.') ? templateName : `.${templateName}`;
  
  const mediaMatch = mediaQuery.match(/^(@media[^{]+)\{(.+)\}$/s);
  if (!mediaMatch) return mediaQuery;
  
  const mediaAtRule = mediaMatch[1];
  const innerContent = mediaMatch[2];
  
  const rules = splitRules(innerContent);
  
  const prefixedRules = rules.map(rule => {
    const trimmed = rule.trim();
    if (!trimmed) return '';
    
    if (trimmed.startsWith('@') || trimmed.startsWith('//')) {
      return trimmed;
    }
    
    if (trimmed.includes('{')) {
      const braceIndex = trimmed.indexOf('{');
      const selectorPart = trimmed.slice(0, braceIndex);
      const stylePart = trimmed.slice(braceIndex);
      
      const selectors = selectorPart.split(',').map(s => s.trim()).filter(Boolean);
      const prefixedSelectors = selectors.map(s => {
        if (isRootElement(s)) {
          return s;
        }
        return `${classPrefix} ${s}`;
      }).join(', ');
      
      return prefixedSelectors + stylePart;
    }
    
    return prefixSelector(trimmed, templateName);
  });
  
  return `${mediaAtRule}{\n${prefixedRules.join('\n\n')}\n}`;
}

export function prefixCss(css: string, templateName: string): string {
  if (!css || !css.trim()) return '';
  if (!templateName) return css;
  
  const rules = splitRules(css);
  
  const prefixed = rules.map(rule => {
    const trimmed = rule.trim();
    if (!trimmed) return '';
    
    if (trimmed.startsWith('@media')) {
      return prefixMediaQuery(trimmed, templateName);
    }
    
    if (trimmed.startsWith('@') || trimmed.startsWith('//')) {
      return trimmed;
    }
    
    if (trimmed.includes('{')) {
      const braceIndex = trimmed.indexOf('{');
      const selectorPart = trimmed.slice(0, braceIndex);
      const stylePart = trimmed.slice(braceIndex);
      
      const selectors = selectorPart.split(',').map(s => s.trim()).filter(Boolean);
      const prefixedSelectors = selectors.map(s => prefixSelector(s, templateName)).join(', ');
      
      return prefixedSelectors + stylePart;
    }
    
    return prefixSelector(trimmed, templateName);
  });
  
  return prefixed.join('\n\n');
}

export function processCss(input: string, options: PrefixOptions): string {
  return prefixCss(input, options.templateName);
}
