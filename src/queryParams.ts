import { IConditionalExpression, IGroupBy, ILimitOffset, IOrderBy, IResultColumn } from '@swivel-admin/node-jql'

export type FieldParams = string | [string, string] | { column: [string, string], $as?: string } | IResultColumn

export type GroupByParams = string | IGroupBy

export type OrderByParams = string | IOrderBy | { key: string, direction?: 'ASC' | 'DESC' }

export interface IQueryParams {
  distinct?: boolean
  fields?: FieldParams[]
  tables?: string[]
  subqueries?: { [key: string]: true | { value: any } | { from: any; to: any } | any }
  groupBy?: GroupByParams[]
  sorting?: OrderByParams | OrderByParams[]
  limit?: number | ILimitOffset

  // extra
  conditions?: IConditionalExpression
  constants?: any
}