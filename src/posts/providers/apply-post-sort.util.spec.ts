import { SelectQueryBuilder } from 'typeorm'
import { Post } from '../entities/post.entity'
import { applyPostSort } from './apply-post-sort.util'

// A minimal fake query builder — only orderBy/addOrderBy are exercised by
// applyPostSort, and both need to be chainable like the real TypeORM API.
function makeFakeQb(): SelectQueryBuilder<Post> {
  const qb = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
  }
  return qb as unknown as SelectQueryBuilder<Post>
}

describe('applyPostSort', () => {
  it('sorts by createdAt desc and adds an id tiebreaker in the same direction', () => {
    const qb = makeFakeQb()
    applyPostSort(qb, 'createdAt', 'desc')
    expect(qb.orderBy).toHaveBeenCalledWith('post.createdAt', 'DESC')
    expect(qb.addOrderBy).toHaveBeenCalledWith('post.id', 'DESC')
  })

  it('sorts by createdAt asc and adds an id tiebreaker in the same direction', () => {
    const qb = makeFakeQb()
    applyPostSort(qb, 'createdAt', 'asc')
    expect(qb.orderBy).toHaveBeenCalledWith('post.createdAt', 'ASC')
    expect(qb.addOrderBy).toHaveBeenCalledWith('post.id', 'ASC')
  })

  it('sorts by title asc and adds an id tiebreaker', () => {
    const qb = makeFakeQb()
    applyPostSort(qb, 'title', 'asc')
    expect(qb.orderBy).toHaveBeenCalledWith('post.title', 'ASC')
    expect(qb.addOrderBy).toHaveBeenCalledWith('post.id', 'ASC')
  })

  it('sorts by title desc and adds an id tiebreaker', () => {
    const qb = makeFakeQb()
    applyPostSort(qb, 'title', 'desc')
    expect(qb.orderBy).toHaveBeenCalledWith('post.title', 'DESC')
    expect(qb.addOrderBy).toHaveBeenCalledWith('post.id', 'DESC')
  })
})
