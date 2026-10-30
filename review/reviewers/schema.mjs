// Providers with strict structured output require every object key. Keep that
// transport constraint out of the common protocol: optional properties use null
// on the wire and are removed before common validation.
export function strictSchema(schema) {
  if(schema.type==='object') return {...schema,required:Object.keys(schema.properties),properties:Object.fromEntries(Object.entries(schema.properties).map(([key,value])=>[
    key,(schema.required ?? []).includes(key)?strictSchema(value):{anyOf:[strictSchema(value),{type:'null'}]},
  ]))};
  if(schema.type==='array') return {...schema,items:strictSchema(schema.items)};
  return schema;
}
export function normalizeOptional(value,schema) {
  if(schema.type==='array' && Array.isArray(value)) return value.map(v=>normalizeOptional(v,schema.items));
  if(schema.type==='object' && value && typeof value==='object') return Object.fromEntries(Object.entries(value)
    .filter(([key,v])=>v!==null || (schema.required ?? []).includes(key))
    .map(([key,v])=>[key,schema.properties[key]?normalizeOptional(v,schema.properties[key]):v]));
  return value;
}
