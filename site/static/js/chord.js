function ChordDiagram() {
  var chord = d3.layout.chord();
  var canvas;
  var svg;
  var svgGroup;
  var adjacency;
  var depts;
  var width;
  var height;
  var outerRadius;
  var innerRadius;
  var fill;
  var arc;
  var deptArcs;
  var deptTexts;
  var deptChords;

  function view(svgNode, data) {
    canvas = svgNode;
    svg = d3.select(svgNode);
    depts = data.info;
    adjacency = data.adjacency;

    // dept to color mapper
    fill = d3.scale.category20b();

    // set up chord layout
    chord
      .matrix(adjacency)
      .padding(Math.PI / (2 * adjacency.length));

    // setup svg
    initSize();
    svg
      .attr('width', width)
      .attr('height', height);

    // for centering offset
    svgGroup = svg
      .append('g')
      .attr('transform', 'translate(' + (width / 2) + ',' + (height / 2) + ')')
      .on('mouseleave', showAllChords);

    // populate data into svg
    var g = svgGroup.selectAll('.group')
      .data(chord.groups)
    .enter().append('g')
      .attr('class', 'group');

    arc = d3.svg.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    deptArcs = g.append('path')
      .attr('class', 'arc')
      .style('fill', function(d) { return d3.rgb(fill(d.index)).darker(); })
      .style('stroke', function(d) { return fill(d.index); })
      .attr('d', arc)
      .on('mouseenter', hideUnrelatedChords)
      .on('click', openCoursePage);

    deptTexts = g.append('text')
      .each(function(d) { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr('dy', '.35em')
      .style('font-size', '.85em')
      .attr('transform', function(d) {
        return 'rotate(' + (d.angle * 180 / Math.PI - 90) + ')'
          + 'translate(' + (outerRadius * 1.03) + ')' // offset for text
          + (d.angle > Math.PI ? 'rotate(180)' : '');
      })
      .style('text-anchor', function(d) { return d.angle > Math.PI ? 'end' : null; })
      .text(function(d) { return depts[d.index].code + ' (' + depts[d.index].number + ')'; });

    deptChords = svgGroup.selectAll('.chord')
      .data(chord.chords)
    .enter().append('path')
      .attr('class', 'chord')
      .style('stroke', function(d) { return d3.rgb(fill(d.source.index)).darker(); })
      .style('fill', function(d) { return fill(d.source.index); })
      .attr('d', d3.svg.chord().radius(innerRadius));

    // add table of departments to sidebar so that it can interact with the svg
    var table = d3.select('#sidebar').append('table')
      .attr('class', 'table table-striped table-hover');
    var header = table.append('thead').append('tr');
    header.append('td').append('strong').text('#');
    header.append('td').append('strong');
    header.append('td').append('strong').text('Department name');
    header.append('td').append('strong').text('Course count');

    var rows = table.append('tbody')
    .selectAll('tr')
      .data(depts)
    .enter().append('tr')
      .on('mouseover', hideUnrelatedChords)
      .on('mouseleave', showAllChords);

    rows.append('td')
      .text(function(d) { return d.number; });
    rows.append('td')
      .style('text-align', 'center')
    .append('span')
      .attr('class', 'label')
      .style('background-color', function(d, i) { return d3.rgb(fill(i)).darker(); })
      .style('text-align', 'center')
      .style('line-height', 'inherit')
      .style('display', 'block')
      .text(function(d) { return d.code; });
    rows.append('td').append('a').attr('href', function(d) { return '/courses/' + d.number; })
      .text(function(d) { return d.name; });
    rows.append('td')
      .text(function(d) { return d.count; });
  }

  function hideUnrelatedChords(d, i) {
    deptChords.classed('fade', function(p) {
      return p.source.index != i && p.target.index != i;
    });
  }

  function showAllChords(d, i) {
    deptChords.classed('fade', false);
  }

  function openCoursePage(d, i) {
    window.location = '/courses/' + depts[i].number;
  }

  function initSize() {
    var rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    outerRadius = Math.min(width, height) / 2.8;
    innerRadius = outerRadius / 1.08;
  }

  view.resize = function() {
    initSize();
    svgGroup.attr('transform', 'translate(' + (width / 2) + ',' + (height / 2) + ')');

    arc
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    deptArcs.attr('d', arc);
    deptTexts
      .attr('transform', function(d) {
        return 'rotate(' + (d.angle * 180 / Math.PI - 90) + ')'
          + 'translate(' + (outerRadius * 1.03) + ')' // offset for text
          + (d.angle > Math.PI ? 'rotate(180)' : '');
      });
    deptChords
      .attr('d', d3.svg.chord().radius(innerRadius));
  }

  window.onresize = view.resize;

  return view;
}

var viz = ChordDiagram();

d3.json('/data/departments', function(data) {
  // the matrix in the data only corresponds to prereqs and coreqs, and
  // does not reflect the size of the department by course count. Here,
  // we do a mathematically questionable hack to redistribute the weights
  // of the departments to reflect their sizes. Specifically, the sum of
  // all entries in a row should add up to the number of courses in that
  // department.
  var reqSums = data.adjacency.map(function(dept, i) {
    return dept.reduce(function(a, b) { return a + b; });
  });

  data.adjacency = data.adjacency.map(function(dept, i) {
    return dept.map(function(other, j) {
      // if a department has no prereqs or coreqs with other departments, we'll
      // redistribute all of its weight to itself.
      if (reqSums[i] == 0) {
        if (j == i)
          return data.info[i].count;
        return 0;
      }
      return other * data.info[i].count / reqSums[i];
    });
  });

  viz(document.querySelector('#main svg'), data);
});