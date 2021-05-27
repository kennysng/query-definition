import debug = require('debug')
import { GroupBy, IExpression, IFromTable, OrderBy, ResultColumn } from 'node-jql'
import { QueryDef } from '.'
import { Prerequisite, QueryArg, SubqueryArg } from './interface'
import { IQueryParams } from './queryParams'
import { SubqueryDef } from './subquery'

const warn = debug('QueryDef:warn')

type CommonFunc<T> = (registered: { [key: string]: IExpression }) => T | Promise<T>
type CommonType<T> = T | CommonFunc<T>

type UnknownType = boolean | { noOfUnknowns?: number; fromTo?: boolean } | Array<[string, number]>

export interface IShortcutContext<T = any> {
  registered: { [key: string]: IExpression }
  regPrerequisites: { [key: string]: Prerequisite }
  options: T
}

export type ShortcutFunc<T extends IBaseShortcut, U = any> =
  (this: QueryDef, shortcut: T, context: IShortcutContext & U) => Promise<void>

export interface IBaseShortcut {
  type: string
  name: string
  prerequisite?: Prerequisite

  // backward compatible
  companions?: string[]|((params: IQueryParams) => string[] | Promise<string[]>)
}

export interface IQueryArgShortcut extends IBaseShortcut {
  type: 'field'|'table'|'groupBy'|'orderBy'
  queryArg: CommonFunc<QueryArg>
}

export interface IFieldShortcut extends IBaseShortcut {
  type: 'field'
  expression: CommonType<IExpression>
  registered?: boolean
}

export interface ITableShortcut extends IBaseShortcut {
  type: 'table'
  fromTable: CommonType<IFromTable>
}

export interface ISubqueryShortcut extends IBaseShortcut {
  type: 'subquery'
  expression: CommonType<IExpression>
  unknowns?: UnknownType
}

export interface ISubqueryArgShortcut extends IBaseShortcut {
  type: 'subquery'
  subqueryArg: CommonFunc<SubqueryArg>
  unknowns?: UnknownType
}

export interface IGroupByShortcut extends IBaseShortcut {
  type: 'groupBy'
  expression: CommonType<IExpression>
}

export interface IOrderByShortcut extends IBaseShortcut {
  type: 'orderBy'
  expression: CommonType<IExpression>
  direction?: 'ASC'|'DESC'
}

export type DefaultShortcuts = IQueryArgShortcut | IFieldShortcut | ITableShortcut | ISubqueryShortcut | ISubqueryArgShortcut | IGroupByShortcut | IOrderByShortcut

export const FieldShortcutFunc: ShortcutFunc<IFieldShortcut | IQueryArgShortcut> = async function(this: QueryDef, shortcut: IFieldShortcut | IQueryArgShortcut, context: IShortcutContext) {
  let { name, prerequisite } = shortcut

  let queryArg: QueryArg | undefined
  if ('expression' in shortcut) {
    const expression = typeof shortcut.expression === 'function' ? await shortcut.expression(context.registered) : shortcut.expression
    if ('registered' in shortcut && shortcut.registered) {
      context.registered[name] = expression
      if (prerequisite) context.regPrerequisites[name] = prerequisite
    }
    queryArg = { $select: new ResultColumn(expression, name) }
  }
  else if ('queryArg' in shortcut) {
    queryArg = await shortcut.queryArg(context.registered)
  }

  if (queryArg) {
    this.field(name, queryArg, prerequisite)
  }
  else {
    warn(`Invalid field:${name}`)
  }
}

export const TableShortcutFunc: ShortcutFunc<ITableShortcut | IQueryArgShortcut> = async function(this: QueryDef, shortcut: ITableShortcut | IQueryArgShortcut, context: IShortcutContext) {
  let { name, prerequisite } = shortcut

  let queryArg: QueryArg | undefined
  if ('fromTable' in shortcut) {
    queryArg = { $from: typeof shortcut.fromTable === 'function' ? await shortcut.fromTable(context.registered) : shortcut.fromTable }
  }
  else if ('queryArg' in shortcut) {
    queryArg = await shortcut.queryArg(context.registered)
  }

  if (queryArg) {
    this.table(name, queryArg, prerequisite)
  }
  else {
    warn(`Invalid table:${name}`)
  }
}

export const SubqueryShortcutFunc: ShortcutFunc<ISubqueryShortcut | ISubqueryArgShortcut> = async function(this: QueryDef, shortcut: ISubqueryShortcut | ISubqueryArgShortcut, context: IShortcutContext) {
  let { name, prerequisite } = shortcut

  let subqueryArg: SubqueryArg | undefined
  if ('expression' in shortcut) {
    subqueryArg = { $where: typeof shortcut.expression === 'function' ? await shortcut.expression(context.registered) : shortcut.expression }
  }
  else if ('subqueryArg' in shortcut) {
    subqueryArg = await shortcut.subqueryArg(context.registered)
  }

  if (subqueryArg) {
    const subqueryDef = this.subquery(name, subqueryArg, prerequisite)

    if ('unknowns' in shortcut) {
      if (Array.isArray(shortcut.unknowns)) {
        for (const [name, index] of shortcut.unknowns) {
          subqueryDef.register(name, index)
        }
      }
      else if (shortcut.unknowns && typeof shortcut.unknowns !== 'boolean' && shortcut.unknowns.fromTo) {
        const noOfUnknowns = shortcut.unknowns.noOfUnknowns || 2
        for (let i = 0, length = noOfUnknowns; i < length; i += 2) {
          subqueryDef.register('from', i)
          subqueryDef.register('to', i + 1)
        }
      }
      else if (shortcut.unknowns) {
        const noOfUnknowns = typeof shortcut.unknowns !== 'boolean' && shortcut.unknowns.noOfUnknowns || 1
        for (let i = 0, length = noOfUnknowns; i < length; i += 1) {
          subqueryDef.register('value', i)
        }
      }
    }
  }
  else {
    warn(`Invalid subquery:${name}`)
  }
}

export const GroupByShortcutFunc: ShortcutFunc<IGroupByShortcut | IQueryArgShortcut> = async function(this: QueryDef, shortcut: IGroupByShortcut | IQueryArgShortcut, context: IShortcutContext) {
  let { name, prerequisite } = shortcut

  let queryArg: QueryArg | undefined
  if ('expression' in shortcut) {
    queryArg = { $group: new GroupBy([typeof shortcut.expression === 'function' ? await shortcut.expression(context.registered) : shortcut.expression]) }
  }
  else if ('queryArg' in shortcut) {
    queryArg = await shortcut.queryArg(context.registered)
  }

  if (queryArg) {
    this.groupBy(name, queryArg, prerequisite)
  }
  else {
    warn(`Invalid groupBy:${name}`)
  }
}

export const OrderByShortcutFunc: ShortcutFunc<IOrderByShortcut | IQueryArgShortcut> = async function(this: QueryDef, shortcut: IOrderByShortcut | IQueryArgShortcut, context: IShortcutContext) {
  let { name, prerequisite } = shortcut

  let queryArg: QueryArg | undefined
  if ('expression' in shortcut) {
    const direction: 'ASC'|'DESC' = shortcut['direction'] || 'ASC'
    queryArg = { $order: new OrderBy(typeof shortcut.expression === 'function' ? await shortcut.expression(context.registered) : shortcut.expression, direction) }
  }
  else if ('queryArg' in shortcut) {
    queryArg = await shortcut.queryArg(context.registered)
  }
  if (queryArg) {
    this.orderBy(name, queryArg, prerequisite)
  }
  else {
    warn(`Invalid orderBy:${name}`)
  }
}
